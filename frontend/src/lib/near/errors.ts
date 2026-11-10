import { ContractMissingError, ContractPanicError, RpcUnreachableError, TxProblemError, TxTimeoutError } from "@/lib/near/provider";

/** Every ERR_* code in docs/CONTRACTS.md section 10, plus ERR_COOLDOWN from the tUSDC faucet. */
export const ERROR_CODES = [
  "ERR_NOT_HOST",
  "ERR_NOT_OWNER",
  "ERR_HAJAT_NOT_FOUND",
  "ERR_TOKEN_NOT_FOUND",
  "ERR_HAJAT_NOT_OPEN",
  "ERR_INVITE_ONLY",
  "ERR_ALREADY_INVITED",
  "ERR_QUOTA_FULL",
  "ERR_BAD_INPUT",
  "ERR_BAD_TIME",
  "ERR_DEPOSIT_TOO_LOW",
  "ERR_WRONG_TOKEN",
  "ERR_BAD_MSG",
  "ERR_NOT_SENDER_OWNER",
  "ERR_BAD_STATE",
  "ERR_TOO_SMALL",
  "ERR_TOO_EARLY",
  "ERR_TOO_LATE",
  "ERR_HAS_OPENED",
  "ERR_SOULBOUND",
  "ERR_NOT_REFUNDABLE",
  "ERR_PRIVATE",
  "ERR_GAS",
  "ERR_OVERFLOW",
  "ERR_LOW_BALANCE",
  "ERR_COOLDOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const CODE_PATTERN = /ERR_[A-Z_]+/;

export function isKnownCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

/** Pulls the first ERR_* code out of any panic message, or null. */
export function extractErrorCode(message: string): string | null {
  return CODE_PATTERN.exec(message)?.[0] ?? null;
}

export interface FriendlyError {
  /** i18n key, always present in both dictionaries */
  key: string;
  /** raw code to show in small text, when the contract sent one */
  code: string | null;
}

/** Maps anything thrown by the near layer to an i18n key. Unknown input maps to `err.unknown`. */
export function toFriendlyError(error: unknown): FriendlyError {
  if (error instanceof RpcUnreachableError) return { key: "err.rpc", code: null };
  if (error instanceof TxTimeoutError) return { key: "err.tx_timeout", code: null };
  if (error instanceof ContractMissingError) return { key: "err.not_deployed", code: null };
  if (error instanceof TxProblemError) return { key: error.key, code: null };

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const code = error instanceof ContractPanicError ? error.code : extractErrorCode(message);
  if (code && isKnownCode(code)) return { key: `err.${code}`, code };
  return { key: "err.unknown", code };
}
