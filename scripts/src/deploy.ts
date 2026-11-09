// Deploys Promise to NEAR testnet. Safe to re-run: it only does what the chain is still missing.
//
//   pnpm deploy:testnet                            dry run, reads the chain, sends nothing
//   pnpm deploy:testnet -- --execute     sends the transactions
//
// The root key is read from the near-cli key folder (see credentials.ts) and never printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KeyPair } from "near-api-js";
import { Chain, newKeyPair, wasmHash, type TxInfo } from "./chain.js";
import { formatNear, loadConfig, type Config } from "./config.js";
import { loadRootKey } from "./credentials.js";
import { envLocal, updatePersonaFile, type PersonaFile } from "./outputs.js";
import { buildPlan, checkBudget, describeStep, nearNeeded, type ChainState, type Step } from "./plan.js";

const EXPLORER = "https://testnet.nearblocks.io";

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function readWasm(path: string, name: string): Uint8Array {
  if (!existsSync(path)) {
    fail(
      `${name} wasm not found at ${path}.\nBuild it first (pnpm contracts:build in WSL) and copy it there, or set ${name.toUpperCase()}_WASM.`,
    );
  }
  return new Uint8Array(readFileSync(path));
}

async function gatherState(chain: Chain, cfg: Config, hashes: { tusdc: string; amplop: string }): Promise<ChainState> {
  const ids = [cfg.root, cfg.tusdc, cfg.amplop, ...cfg.personas.map((p) => p.account)];
  const accounts: ChainState["accounts"] = {};
  for (const id of ids) accounts[id] = await chain.accountState(id);

  for (const [id, guard] of [
    [cfg.tusdc, "get_owner"],
    [cfg.amplop, "get_config"],
  ] as const) {
    const s = accounts[id];
    if (s?.exists && s.codeHash) s.initialized = await chain.answers(id, guard);
  }

  const tusdc: ChainState["tusdc"] = {};
  if (accounts[cfg.tusdc]?.initialized) {
    for (const id of [cfg.amplop, ...cfg.personas.map((p) => p.account)]) {
      const registered = await chain.view<unknown>(cfg.tusdc, "storage_balance_of", { account_id: id });
      tusdc[id] = registered
        ? BigInt(await chain.view<string>(cfg.tusdc, "ft_balance_of", { account_id: id }))
        : null;
    }
  }
  return { accounts, tusdc, wasmHash: hashes };
}

async function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const cfg = loadConfig(process.argv.slice(2), process.env, repoRoot);
  const personaPath = join(repoRoot, "frontend", "src", "lib", "demo", "personas.public.json");

  console.log(`Promise deploy, root ${cfg.root}, ${cfg.execute ? "EXECUTE" : "dry run (nothing is sent)"}`);

  const rootKey = loadRootKey(cfg.root);
  const chain = new Chain(cfg.rpcUrl, rootKey);
  const network = await chain.networkId();
  if (network !== "testnet") fail(`RPC reports network "${network}". Only testnet is allowed.`);

  const wasm = {
    tusdc: readWasm(cfg.tusdcWasm, "tusdc"),
    amplop: readWasm(cfg.amplopWasm, "amplop"),
  };
  const hashes = { tusdc: wasmHash(wasm.tusdc), amplop: wasmHash(wasm.amplop) };
  console.log(`tusdc.wasm  ${(wasm.tusdc.length / 1024).toFixed(1)} KB  ${hashes.tusdc}`);
  console.log(`amplop.wasm ${(wasm.amplop.length / 1024).toFixed(1)} KB  ${hashes.amplop}`);

  const state = await gatherState(chain, cfg, hashes);
  const rootBalance = state.accounts[cfg.root]?.nearBalance ?? 0n;
  if (!state.accounts[cfg.root]?.exists) fail(`Root account ${cfg.root} does not exist on testnet.`);
  console.log(`root balance ${formatNear(rootBalance)} NEAR`);

  const steps = buildPlan(cfg, state);
  if (steps.length === 0) console.log("\nNothing to do: everything is already deployed and funded.");
  else {
    console.log(`\nPlan (${steps.length} steps, ${formatNear(nearNeeded(steps))} NEAR handed out):`);
    steps.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${describeStep(s)}`));
  }

  const old = state.accounts[cfg.amplop];
  const credit = cfg.reset ? (old?.nearTotal ?? old?.nearBalance ?? 0n) : 0n;
  const budget = checkBudget(rootBalance, steps, credit);
  if (budget) fail(budget);

  if (!cfg.execute) {
    console.log("\nDry run only. Add --execute to send these transactions.");
    return;
  }

  // Persona keys are written to disk before any transaction that uses them, so a crash
  // between "account created" and "key saved" can never strand an account.
  const personaFile = JSON.parse(readFileSync(personaPath, "utf8")) as PersonaFile;
  const keys: Record<string, string> = {};
  for (const p of personaFile.personas) if (p.secret_key) keys[p.id] = p.secret_key;
  const publicKeyOf = (id: string): string => {
    let secret = keys[id];
    if (!secret) {
      secret = newKeyPair().secretKey;
      keys[id] = secret;
      writeFileSync(personaPath, JSON.stringify(updatePersonaFile(personaFile, cfg, keys), null, 2) + "\n");
    }
    return KeyPair.fromString(secret as never).getPublicKey().toString();
  };

  const txs: { step: string; hash: string }[] = [];
  const record = (step: Step, tx: TxInfo) => {
    txs.push({ step: describeStep(step), hash: tx.hash });
    console.log(`      ${EXPLORER}/txns/${tx.hash}`);
  };

  for (const [i, step] of steps.entries()) {
    console.log(`\n[${i + 1}/${steps.length}] ${describeStep(step)}`);
    try {
      switch (step.kind) {
        case "delete-account":
          record(step, await chain.deleteAccount(step.account));
          break;
        case "create-contract":
          record(step, await chain.createContractAccount(step.account, chain.rootPublicKey, step.fund, wasm[step.wasm], step.init));
          break;
        case "redeploy":
          record(step, await chain.redeploy(step.account, wasm[step.wasm]));
          break;
        case "init":
          record(step, await chain.init(step.account, step.init));
          break;
        case "create-persona": {
          const id = cfg.personas.find((p) => p.account === step.account)?.id ?? "";
          record(step, await chain.createPlainAccount(step.account, publicKeyOf(id), step.fund));
          break;
        }
        case "top-up-persona":
          record(step, await chain.transfer(step.account, step.amount));
          break;
        case "register":
          record(step, await chain.call(cfg.tusdc, "storage_deposit", { account_id: step.account, registration_only: true }, 2_000_000_000_000_000_000_000n));
          break;
        case "mint":
          record(step, await chain.call(cfg.tusdc, "mint", { account_id: step.account, amount: step.amount.toString() }));
          break;
      }
    } catch (error) {
      fail(`Step ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}\nNothing after this step was run. Fix the cause and run again: finished steps are skipped.`);
    }
  }

  // Persona accounts with keys now on chain: make sure the file has every key.
  writeFileSync(personaPath, JSON.stringify(updatePersonaFile(personaFile, cfg, keys), null, 2) + "\n");

  console.log("\nVerifying...");
  const after = await gatherState(chain, cfg, hashes);
  const problems: string[] = [];
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? "OK  " : "FAIL"} ${label}`);
    if (!ok) problems.push(label);
  };
  for (const [name, id] of [["tusdc", cfg.tusdc], ["amplop", cfg.amplop]] as const) {
    const s = after.accounts[id];
    check(s?.codeHash === hashes[name], `${id} runs the wasm built here`);
    check(s?.initialized === true, `${id} is initialized`);
  }
  if (after.accounts[cfg.amplop]?.initialized) {
    const config = await chain.view<{ owner: string; ft: string }>(cfg.amplop, "get_config");
    check(config.ft === cfg.tusdc, `amplop accepts only ${cfg.tusdc}`);
    check(config.owner === cfg.root, `amplop owner is ${cfg.root}`);
  }
  if (after.accounts[cfg.tusdc]?.initialized) {
    const meta = await chain.view<{ symbol: string; decimals: number }>(cfg.tusdc, "ft_metadata");
    check(meta.symbol === "tUSDC" && meta.decimals === 6, "tUSDC metadata is tUSDC with 6 decimals");
  }
  check(after.tusdc[cfg.amplop] !== null && after.tusdc[cfg.amplop] !== undefined, "amplop is registered on tUSDC");
  for (const p of cfg.personas) {
    const bal = after.tusdc[p.account];
    check(bal !== null && bal !== undefined && bal >= cfg.personaTusdc, `${p.account} holds at least 500 tUSDC`);
    check((after.accounts[p.account]?.nearBalance ?? 0n) > 0n, `${p.account} has NEAR for gas`);
  }

  writeFileSync(join(repoRoot, "frontend", ".env.local"), envLocal(cfg));
  const outDir = join(repoRoot, "scripts", "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "deploy-report.json"),
    JSON.stringify({ at: new Date().toISOString(), root: cfg.root, tusdc: cfg.tusdc, amplop: cfg.amplop, hashes, txs }, null, 2) + "\n",
  );
  console.log("\nWrote frontend/.env.local, frontend/src/lib/demo/personas.public.json and scripts/out/deploy-report.json");

  if (problems.length > 0) fail(`${problems.length} check(s) failed.`);
  console.log(`\nDone. Main contract: ${EXPLORER}/address/${cfg.amplop}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
