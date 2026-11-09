// Replaces the full access key of the root account with a fresh one.
//
//   pnpm --filter @promise/scripts run rotate-key
//
// Order matters, so no step can lock you out:
//   1. write the new key to disk
//   2. add it to the account (signed by the old key)
//   3. delete the old key (signed by the new key)
//   4. replace the old key files, which also removes the old seed phrase from disk
// Secrets are never printed. Only public keys and transaction links are.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Account, JsonRpcProvider, KeyPairSigner, PublicKey, type KeyPairString } from "near-api-js";
import { newKeyPair } from "./chain.js";
import { loadConfig } from "./config.js";
import { locateKeyFile, loadRootKey } from "./credentials.js";

function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const cfg = loadConfig([], process.env, process.cwd());
  const account = cfg.root;
  const old = loadRootKey(account);
  const { dir } = locateKeyFile(account);
  const provider = new JsonRpcProvider({ url: cfg.rpcUrl });
  if ((await provider.getNetworkId()) !== "testnet") fail("Not testnet.");

  const oldAccount = new Account(account, provider, KeyPairSigner.fromSecretKey(old.secretKey as KeyPairString));
  const before = (await oldAccount.getAccessKeyList()).keys;
  console.log(`${account} has ${before.length} access key(s)`);
  if (before.length !== 1 || before[0]?.public_key !== old.publicKey) {
    fail("Expected exactly one key, the one in the key file. Refusing to rotate by guess.");
  }

  // 1. new key on disk first
  const fresh = newKeyPair();
  const entry = { account_id: account, public_key: fresh.publicKey, private_key: fresh.secretKey };
  const perKeyDir = join(dir, account);
  mkdirSync(perKeyDir, { recursive: true });
  const newFile = join(perKeyDir, `${fresh.publicKey.replace(":", "_")}.json`);
  writeFileSync(newFile, JSON.stringify(entry), { mode: 0o600 });
  console.log(`new public key ${fresh.publicKey}`);

  // 2. add it
  const add = await oldAccount.addFullAccessKey(PublicKey.from(fresh.publicKey));
  console.log(`added:   https://testnet.nearblocks.io/txns/${add.transaction.hash}`);

  // 3. delete the old one, signed by the new key
  const newAccount = new Account(account, provider, KeyPairSigner.fromSecretKey(fresh.secretKey as KeyPairString));
  const del = await newAccount.deleteKey(PublicKey.from(old.publicKey));
  console.log(`removed: https://testnet.nearblocks.io/txns/${del.transaction.hash}`);

  const after = (await newAccount.getAccessKeyList()).keys.map((k) => k.public_key);
  if (after.length !== 1 || after[0] !== fresh.publicKey) fail(`Unexpected keys after rotation: ${after.join(", ")}`);
  console.log("on chain: exactly one key, the new one");

  // 4. replace the old files. The main file keeps the same name so every tool finds the new key.
  writeFileSync(join(dir, `${account}.json`), JSON.stringify(entry), { mode: 0o600 });
  for (const name of readdirSync(perKeyDir)) {
    if (join(perKeyDir, name) !== newFile) rmSync(join(perKeyDir, name));
  }
  if (!existsSync(newFile)) fail("New key file is missing after cleanup.");
  console.log("old key files removed, new key saved");
  console.log("\nRotation finished. The old key and the seed phrase that was shown in the chat no longer control this account.");
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
