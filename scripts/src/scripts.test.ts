import { describe, expect, it } from "vitest";
import { formatNear, formatTusdc, loadConfig, parseNear, type Config } from "./config.js";
import { parseCredentialFile } from "./credentials.js";
import { envLocal, updatePersonaFile, type PersonaFile } from "./outputs.js";
import { buildPlan, checkBudget, describeStep, nearNeeded, type ChainState } from "./plan.js";

const ROOT = "promisedemo.testnet";
const cfg = (env: NodeJS.ProcessEnv = {}, argv: string[] = []): Config => loadConfig(argv, env, "/repo");

const HASH = { tusdc: "hashT", amplop: "hashA" };

function fresh(config: Config): ChainState {
  return {
    accounts: { [config.root]: { exists: true, codeHash: null, initialized: null, nearBalance: 19_800n * 10n ** 21n } },
    tusdc: {},
    wasmHash: HASH,
  };
}

/** A chain where everything the plan creates already exists and is funded. */
function deployed(config: Config): ChainState {
  const ok = { exists: true, nearBalance: 5n * 10n ** 24n };
  const accounts: ChainState["accounts"] = {
    [config.root]: { exists: true, codeHash: null, initialized: null, nearBalance: 10n * 10n ** 24n },
    [config.tusdc]: { ...ok, codeHash: HASH.tusdc, initialized: true },
    [config.amplop]: { ...ok, codeHash: HASH.amplop, initialized: true },
  };
  const tusdc: ChainState["tusdc"] = { [config.amplop]: 0n };
  for (const p of config.personas) {
    accounts[p.account] = { ...ok, codeHash: null, initialized: null };
    tusdc[p.account] = config.personaTusdc;
  }
  return { accounts, tusdc, wasmHash: HASH };
}

describe("amounts", () => {
  it("parses and formats NEAR", () => {
    expect(parseNear("4")).toBe(4n * 10n ** 24n);
    expect(parseNear("0.5")).toBe(5n * 10n ** 23n);
    expect(formatNear(parseNear("19.8"))).toBe("19.8");
    expect(formatNear(parseNear("8"))).toBe("8");
  });
  it("rejects junk", () => {
    for (const bad of ["", "-1", "1e3", "1.", ".5", "4 NEAR", "1.1234567890123456789012345"]) {
      expect(() => parseNear(bad), bad).toThrow();
    }
  });
  it("formats tUSDC", () => {
    expect(formatTusdc(500_000_000n)).toBe("500.00");
    expect(formatTusdc(1_500_000n)).toBe("1.50");
  });
});

describe("config", () => {
  it("derives every account from the root", () => {
    const c = cfg();
    expect(c.tusdc).toBe(`tusdc.${ROOT}`);
    expect(c.amplop).toBe(`amplop.${ROOT}`);
    expect(c.personas.map((p) => p.account)).toEqual(
      ["ayu", "budi", "citra", "dewi", "eko"].map((n) => `${n}.${ROOT}`),
    );
    expect(c.execute).toBe(false);
  });
  it("only executes with --execute", () => {
    expect(cfg({}, ["--execute"]).execute).toBe(true);
  });
  it("refuses a root that is not on testnet", () => {
    expect(() => cfg({ ROOT_ACCOUNT: "someone.near" })).toThrow(/testnet/);
    expect(() => cfg({}, ["--root", "bad name.testnet"])).toThrow();
  });
  it("refuses a mainnet rpc url", () => {
    expect(() => cfg({ RPC_URL: "https://rpc.mainnet.near.org" })).toThrow(/mainnet/);
  });
  it("takes funding overrides from the environment", () => {
    expect(cfg({ FUND_AMPLOP: "5" }).fund.amplop).toBe(5n * 10n ** 24n);
  });
});

describe("credentials", () => {
  const file = (o: object) => JSON.stringify(o);
  const good = { account_id: ROOT, public_key: "ed25519:AAA", private_key: "ed25519:BBB" };

  it("reads a near-cli key file", () => {
    expect(parseCredentialFile(file(good), ROOT)).toEqual({
      accountId: ROOT,
      publicKey: "ed25519:AAA",
      secretKey: "ed25519:BBB",
    });
  });
  it("rejects the wrong account, other key types and broken files", () => {
    expect(() => parseCredentialFile(file(good), "other.testnet")).toThrow(/expected/);
    expect(() => parseCredentialFile(file({ ...good, private_key: "secp256k1:X" }), ROOT)).toThrow(/ed25519/);
    expect(() => parseCredentialFile(file({ account_id: ROOT }), ROOT)).toThrow(/needs/);
    expect(parseCredentialFile(file({ public_key: "ed25519:AAA", private_key: "ed25519:BBB", master_seed_phrase: "x" }), ROOT).accountId).toBe(ROOT);
    expect(() => parseCredentialFile("not json", ROOT)).toThrow(/JSON/);
  });
  it("does not leak the secret key in its errors", () => {
    try {
      parseCredentialFile(file({ ...good, private_key: "secp256k1:TOPSECRET" }), ROOT);
    } catch (e) {
      expect(String(e)).not.toContain("TOPSECRET");
    }
  });
});

describe("plan", () => {
  it("builds everything on an empty chain, in a safe order", () => {
    const c = cfg();
    const steps = buildPlan(c, fresh(c));
    const kinds = steps.map((s) => s.kind);
    expect(kinds.slice(0, 2)).toEqual(["create-contract", "create-contract"]);
    expect(steps[0]).toMatchObject({ account: c.tusdc, wasm: "tusdc" });
    expect(steps[1]).toMatchObject({ account: c.amplop, wasm: "amplop" });
    expect(kinds.filter((k) => k === "create-persona")).toHaveLength(5);
    expect(kinds.filter((k) => k === "register")).toHaveLength(6); // amplop + 5 personas
    expect(kinds.filter((k) => k === "mint")).toHaveLength(5);
    // registering must come after the accounts exist and before minting
    expect(kinds.lastIndexOf("create-persona")).toBeLessThan(kinds.indexOf("register"));
    expect(kinds.lastIndexOf("register")).toBeLessThan(kinds.indexOf("mint"));
  });

  it("initializes amplop with the tusdc account and the app url", () => {
    const c = cfg({ APP_URL: "https://promise.example" });
    const step = buildPlan(c, fresh(c)).find((s) => s.kind === "create-contract" && s.wasm === "amplop");
    expect(step).toMatchObject({
      init: { method: "new", args: { owner_id: ROOT, ft_id: `tusdc.${ROOT}`, app_url: "https://promise.example" } },
    });
  });

  it("is a no-op when everything is already deployed", () => {
    const c = cfg();
    expect(buildPlan(c, deployed(c))).toEqual([]);
  });

  it("redeploys only the contract whose code changed", () => {
    const c = cfg();
    const state = deployed(c);
    state.accounts[c.amplop] = { ...state.accounts[c.amplop]!, codeHash: "old" };
    expect(buildPlan(c, state)).toEqual([{ kind: "redeploy", account: c.amplop, wasm: "amplop" }]);
  });

  it("calls new() on a contract that has code but was never initialized", () => {
    const c = cfg();
    const state = deployed(c);
    state.accounts[c.tusdc] = { ...state.accounts[c.tusdc]!, initialized: false };
    expect(buildPlan(c, state).map((s) => s.kind)).toEqual(["init"]);
  });

  it("registers and funds only what is missing", () => {
    const c = cfg();
    const state = deployed(c);
    const dewi = c.personas.find((p) => p.id === "dewi")!.account;
    state.tusdc[dewi] = null; // not registered
    state.tusdc[c.personas[0]!.account] = 120_000_000n; // spent some
    const kinds = buildPlan(c, state).map((s) => `${s.kind}:${"account" in s ? s.account : ""}`);
    expect(kinds).toContain(`register:${dewi}`);
    expect(kinds).toContain(`mint:${dewi}`);
    expect(kinds).toContain(`mint:${c.personas[0]!.account}`);
    expect(kinds).toHaveLength(3);
    const topUp = buildPlan(c, state).find((s) => s.kind === "mint" && s.account === c.personas[0]!.account);
    expect(topUp).toMatchObject({ amount: 380_000_000n });
  });

  it("tops up a persona that is out of NEAR", () => {
    const c = cfg();
    const state = deployed(c);
    const eko = c.personas[4]!.account;
    state.accounts[eko] = { ...state.accounts[eko]!, nearBalance: 1000n };
    expect(buildPlan(c, state)).toEqual([{ kind: "top-up-persona", account: eko, amount: c.fund.persona }]);
  });

  it("describes every step in words", () => {
    const c = cfg();
    for (const s of buildPlan(c, fresh(c))) expect(describeStep(s).length).toBeGreaterThan(10);
  });
});

describe("budget", () => {
  it("the default plan fits in the 19.8 NEAR the root has", () => {
    const c = cfg();
    const steps = buildPlan(c, fresh(c));
    // 4 + 8 + 5 personas + registrations
    expect(nearNeeded(steps)).toBeGreaterThanOrEqual(17n * 10n ** 24n);
    expect(checkBudget(19_800n * 10n ** 21n, steps)).toBeNull();
  });
  it("says what to lower when the root is too poor", () => {
    const c = cfg();
    const message = checkBudget(10n * 10n ** 24n, buildPlan(c, fresh(c)));
    expect(message).toMatch(/FUND_AMPLOP/);
    expect(message).toMatch(/10 NEAR/);
  });
  it("needs nothing for a finished deploy", () => {
    const c = cfg();
    expect(checkBudget(2n * 10n ** 24n, buildPlan(c, deployed(c)))).toBeNull();
  });
});

describe("outputs", () => {
  const file: PersonaFile = {
    personas: [
      { id: "ayu", name: "Ayu", account_id: "ayu.old.testnet", role: { en: "r", id: "r" }, blurb: { en: "b", id: "b" }, secret_key: null },
      { id: "budi", name: "Budi", account_id: "budi.old.testnet", role: { en: "r", id: "r" }, blurb: { en: "b", id: "b" }, secret_key: "ed25519:kept" },
    ],
  };

  it("points personas at the new root and keeps existing keys", () => {
    const out = updatePersonaFile(file, cfg(), { ayu: "ed25519:new" });
    expect(out.personas[0]).toMatchObject({ account_id: `ayu.${ROOT}`, secret_key: "ed25519:new" });
    expect(out.personas[1]).toMatchObject({ account_id: `budi.${ROOT}`, secret_key: "ed25519:kept" });
  });

  it("writes only public settings to .env.local", () => {
    const text = envLocal(cfg());
    expect(text).toContain(`NEXT_PUBLIC_AMPLOP_ID=amplop.${ROOT}`);
    expect(text).toContain(`NEXT_PUBLIC_FT_ID=tusdc.${ROOT}`);
    expect(text).not.toMatch(/KEY|SECRET|ed25519/i);
  });
});
