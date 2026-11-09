import { env } from "@/lib/env";
import { MAX_NOTE, MIN_AMPLOP } from "@/lib/near/rules";
import { parseAmount } from "@/lib/near/format";
import type { HajatKind, JoinPolicy } from "@/lib/near/types";

/** One contract call, ready for any signer. */
export interface CallArgs {
  contractId: string;
  method: string;
  args: Record<string, unknown>;
  /** gas in gas units, default 100 Tgas */
  gas?: bigint;
  /** yoctoNEAR, default 0 */
  deposit?: bigint;
}

const TGAS = 10n ** 12n;
const MILLI_NEAR = 10n ** 21n;

// Gas and deposits from docs/FRONTEND.md section 8 and docs/CONTRACTS.md section 11.
const GAS_WRITE = 30n * TGAS;
const GAS_TOKEN = 100n * TGAS;
const GAS_OPEN = 150n * TGAS;
const DEPOSIT_HAJAT = 50n * MILLI_NEAR;
const DEPOSIT_INVITE = 20n * MILLI_NEAR;

export function createHajat(input: {
  title: string;
  kind: HajatKind;
  venue: string;
  eventAtMs: number;
  policy: JoinPolicy;
}): CallArgs {
  return {
    contractId: env.amplopId,
    method: "create_hajat",
    args: {
      title: input.title.trim(),
      kind: input.kind,
      venue: input.venue.trim(),
      event_at_ms: input.eventAtMs,
      join_policy: input.policy,
    },
    gas: GAS_WRITE,
    deposit: DEPOSIT_HAJAT,
  };
}

export function invite(input: { hajatId: number; guest: string; label: string }): CallArgs {
  return {
    contractId: env.amplopId,
    method: "invite",
    args: { hajat_id: input.hajatId, guest: input.guest.trim(), label: input.label.trim() },
    gas: GAS_WRITE,
    deposit: DEPOSIT_INVITE,
  };
}

export function join(input: { hajatId: number; label: string }): CallArgs {
  return {
    contractId: env.amplopId,
    method: "join",
    args: { hajat_id: input.hajatId, label: input.label.trim() },
    gas: GAS_WRITE,
    deposit: DEPOSIT_INVITE,
  };
}

/** Sealing goes through tUSDC: one `ft_transfer_call` with 1 yoctoNEAR, and a JSON message for amplop. */
export function seal(input: { tokenId: number; amount: string; note?: string }): CallArgs {
  const note = input.note?.trim();
  const msg = JSON.stringify(note ? { token_id: String(input.tokenId), note } : { token_id: String(input.tokenId) });
  return {
    contractId: env.ftId,
    method: "ft_transfer_call",
    args: { receiver_id: env.amplopId, amount: input.amount, msg },
    gas: GAS_TOKEN,
    deposit: 1n,
  };
}

export function checkIn(tokenId: number): CallArgs {
  return { contractId: env.amplopId, method: "check_in", args: { token_id: tokenId }, gas: GAS_OPEN };
}

export function cancelHajat(hajatId: number): CallArgs {
  return { contractId: env.amplopId, method: "cancel_hajat", args: { hajat_id: hajatId }, gas: GAS_WRITE };
}

export function refund(tokenId: number): CallArgs {
  return { contractId: env.amplopId, method: "refund", args: { token_id: tokenId }, gas: GAS_TOKEN };
}

// ---------------------------------------------------------------- validation, used by the forms

export type SealProblem = "bad" | "min" | "low";

/** Checks an amount typed by a user. `units` is set when it is usable. */
export function validateSeal(input: string, balance: bigint | null): { units: string | null; problem: SealProblem | null } {
  const units = parseAmount(input);
  if (units === null) return { units: null, problem: "bad" };
  if (BigInt(units) < MIN_AMPLOP) return { units: null, problem: "min" };
  if (balance !== null && BigInt(units) > balance) return { units: null, problem: "low" };
  return { units, problem: null };
}

export function noteTooLong(note: string): boolean {
  return [...note].length > MAX_NOTE;
}

const ACCOUNT_RE = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)+$/;

/** A testnet account id with at least one dot, as the contract needs a real account. */
export function isTestnetAccount(id: string): boolean {
  const v = id.trim();
  return v.length >= 8 && v.length <= 64 && v.endsWith(".testnet") && ACCOUNT_RE.test(v);
}
