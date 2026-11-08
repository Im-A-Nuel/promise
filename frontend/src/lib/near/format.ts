import { env } from "@/lib/env";

// Amounts are formatted only here, at the UI edge. The contract speaks base units (6 decimals).

export const TUSDC_DECIMALS = 6;
const UNIT = 10n ** BigInt(TUSDC_DECIMALS);

/** "5000000" -> "5.00", "5123456" -> "5.123456", "5120000" -> "5.12". Two decimals minimum. */
export function formatAmount(units: string | bigint): string {
  const value = typeof units === "bigint" ? units : BigInt(units);
  const whole = value / UNIT;
  const fraction = (value % UNIT).toString().padStart(TUSDC_DECIMALS, "0");
  let trimmed = fraction.replace(/0+$/, "");
  if (trimmed.length < 2) trimmed = trimmed.padEnd(2, "0");
  return `${whole}.${trimmed}`;
}

export function formatTusdc(units: string | bigint): string {
  return `${formatAmount(units)} tUSDC`;
}

/**
 * User input to base units. "5" -> "5000000", "0.5" -> "500000".
 * Returns null for empty, negative, non-numeric input or more than 6 decimals.
 */
export function parseAmount(input: string): string | null {
  const text = input.trim();
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text);
  if (!match) return null;
  const whole = BigInt(match[1] ?? "0");
  const fraction = BigInt((match[2] ?? "").padEnd(TUSDC_DECIMALS, "0") || "0");
  return (whole * UNIT + fraction).toString();
}

/** Keeps long NEAR account ids on one line: "ayu.promisedemo.testnet" stays, very long ones get an ellipsis. */
export function shortAccount(id: string, max = 28): string {
  if (id.length <= max) return id;
  const head = Math.ceil((max - 1) * 0.6);
  const tail = max - 1 - head;
  return `${id.slice(0, head)}…${id.slice(id.length - tail)}`;
}

export function explorerTxUrl(hash: string): string {
  return `${env.explorerUrl}/txns/${hash}`;
}

export function explorerAccountUrl(account: string): string {
  return `${env.explorerUrl}/address/${account}`;
}

export function formatDate(ms: number, locale: "en" | "id"): string {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}
