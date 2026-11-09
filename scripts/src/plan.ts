import { formatNear, formatTusdc, type Config } from "./config.js";

/** What the chain looks like right now. Gathered by `chain.ts`, consumed here as plain data. */
export interface AccountState {
  exists: boolean;
  /** base58 sha256 of the deployed wasm, null when there is no code */
  codeHash: string | null;
  /** true when the contract answers its init-guarded view, null when there is no code */
  initialized: boolean | null;
  /** spendable NEAR in yocto, 0 when the account does not exist */
  nearBalance: bigint;
}

export interface ChainState {
  accounts: Record<string, AccountState>;
  /** tUSDC balance per account, null when the account is not registered on tUSDC */
  tusdc: Record<string, bigint | null>;
  /** base58 sha256 of the wasm files that will be deployed */
  wasmHash: { tusdc: string; amplop: string };
}

export type Step =
  | { kind: "create-contract"; account: string; wasm: "tusdc" | "amplop"; fund: bigint; init: { method: "new"; args: Record<string, string> } }
  | { kind: "redeploy"; account: string; wasm: "tusdc" | "amplop" }
  | { kind: "init"; account: string; init: { method: "new"; args: Record<string, string> } }
  | { kind: "create-persona"; account: string; fund: bigint }
  | { kind: "top-up-persona"; account: string; amount: bigint }
  | { kind: "register"; account: string }
  | { kind: "mint"; account: string; amount: bigint };

const MIN_PERSONA_NEAR = 200_000_000_000_000_000_000_000n; // 0.2 NEAR
/** Keeps the root able to pay gas after funding everything. */
export const ROOT_RESERVE = 1_000_000_000_000_000_000_000_000n; // 1 NEAR

function missing(): AccountState {
  return { exists: false, codeHash: null, initialized: null, nearBalance: 0n };
}

export function buildPlan(cfg: Config, state: ChainState): Step[] {
  const steps: Step[] = [];
  const get = (id: string) => state.accounts[id] ?? missing();

  const initArgs = {
    tusdc: { method: "new", args: { owner_id: cfg.root } } as const,
    amplop: {
      method: "new",
      args: { owner_id: cfg.root, ft_id: cfg.tusdc, app_url: cfg.appUrl },
    } as const,
  };

  for (const [wasm, account, fund] of [
    ["tusdc", cfg.tusdc, cfg.fund.tusdc],
    ["amplop", cfg.amplop, cfg.fund.amplop],
  ] as const) {
    const s = get(account);
    if (!s.exists) {
      steps.push({ kind: "create-contract", account, wasm, fund, init: { ...initArgs[wasm] } });
      continue;
    }
    if (s.codeHash !== state.wasmHash[wasm]) {
      steps.push({ kind: "redeploy", account, wasm });
      // Redeploying keeps state, so the contract stays initialized unless it never was.
      if (s.initialized !== true) steps.push({ kind: "init", account, init: { ...initArgs[wasm] } });
    } else if (s.initialized !== true) {
      steps.push({ kind: "init", account, init: { ...initArgs[wasm] } });
    }
  }

  for (const p of cfg.personas) {
    const s = get(p.account);
    if (!s.exists) steps.push({ kind: "create-persona", account: p.account, fund: cfg.fund.persona });
    else if (s.nearBalance < MIN_PERSONA_NEAR) {
      steps.push({ kind: "top-up-persona", account: p.account, amount: cfg.fund.persona });
    }
  }

  for (const account of [cfg.amplop, ...cfg.personas.map((p) => p.account)]) {
    if (state.tusdc[account] === undefined || state.tusdc[account] === null) {
      steps.push({ kind: "register", account });
    }
  }

  for (const p of cfg.personas) {
    const have = state.tusdc[p.account] ?? 0n;
    if (have < cfg.personaTusdc) steps.push({ kind: "mint", account: p.account, amount: cfg.personaTusdc - have });
  }

  return steps;
}

/** NEAR the root has to hand out for this plan, not counting gas. */
export function nearNeeded(steps: Step[]): bigint {
  let total = 0n;
  for (const s of steps) {
    if (s.kind === "create-contract" || s.kind === "create-persona") total += s.fund;
    if (s.kind === "top-up-persona") total += s.amount;
    // storage_deposit attaches 0.002 NEAR, almost all of it is refunded
    if (s.kind === "register") total += 2_000_000_000_000_000_000_000n;
  }
  return total;
}

export function describeStep(step: Step): string {
  switch (step.kind) {
    case "create-contract":
      return `create ${step.account} with ${formatNear(step.fund)} NEAR, deploy ${step.wasm}.wasm, call new()`;
    case "redeploy":
      return `redeploy ${step.wasm}.wasm to ${step.account} (code hash differs)`;
    case "init":
      return `call new() on ${step.account} (not initialized)`;
    case "create-persona":
      return `create ${step.account} with ${formatNear(step.fund)} NEAR and a fresh key`;
    case "top-up-persona":
      return `send ${formatNear(step.amount)} NEAR to ${step.account}`;
    case "register":
      return `register ${step.account} on tUSDC (storage_deposit)`;
    case "mint":
      return `mint ${formatTusdc(step.amount)} tUSDC to ${step.account}`;
  }
}

/** Returns a problem description when the root cannot pay for the plan, otherwise null. */
export function checkBudget(rootBalance: bigint, steps: Step[]): string | null {
  const need = nearNeeded(steps) + ROOT_RESERVE;
  if (rootBalance >= need) return null;
  return `Root has ${formatNear(rootBalance)} NEAR but the plan needs ${formatNear(need)} NEAR (including ${formatNear(ROOT_RESERVE)} for gas). Lower FUND_TUSDC, FUND_AMPLOP or FUND_PERSONA, or add NEAR to the root.`;
}
