import { env } from "@/lib/env";

/** The RPC endpoints could not be reached, or answered with an error status. */
export class RpcUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcUnreachableError";
  }
}

/** The account does not exist or has no contract code. Normal before the first deploy. */
export class ContractMissingError extends Error {
  constructor(public readonly contractId: string) {
    super(`No contract at ${contractId}`);
    this.name = "ContractMissingError";
  }
}

/** The contract panicked. `code` is the ERR_* code when the message carries one. */
export class ContractPanicError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = "ContractPanicError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RpcOptions {
  fetchImpl?: FetchLike;
  urls?: string[];
  timeoutMs?: number;
}

const MISSING_PATTERN = /UNKNOWN_ACCOUNT|CodeDoesNotExist|NO_CONTRACT_CODE|does not exist while viewing|has no contract/i;
const CODE_PATTERN = /ERR_[A-Z_]+/;

interface RpcEnvelope {
  result?: unknown;
  error?: unknown;
}

async function post(url: string, body: unknown, fetchImpl: FetchLike, timeoutMs: number): Promise<RpcEnvelope> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new RpcUnreachableError(`RPC ${url} answered ${res.status}`);
  return (await res.json()) as RpcEnvelope;
}

/**
 * JSON-RPC call with one fallback. Network failures and bad statuses move on to the next
 * endpoint; a well-formed answer (even an error about the contract) is returned as is.
 */
export async function rpc(method: string, params: unknown, options: RpcOptions = {}): Promise<RpcEnvelope> {
  const urls = options.urls ?? [env.rpcUrl, env.rpcFallbackUrl];
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 8000;
  const body = { jsonrpc: "2.0", id: "promise", method, params };

  let lastError: unknown;
  for (const url of urls) {
    try {
      return await post(url, body, fetchImpl, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "unknown error";
  throw new RpcUnreachableError(`All RPC endpoints failed: ${reason}`);
}

/** btoa only takes Latin-1, so encode as UTF-8 first. */
function toBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function describeError(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Calls a view method and returns the parsed JSON. Throws typed errors, never returns raw RPC errors. */
export async function viewCall(
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
  options: RpcOptions = {},
): Promise<unknown> {
  const argsBase64 = toBase64(JSON.stringify(args));
  const envelope = await rpc(
    "query",
    { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: argsBase64 },
    options,
  );

  const failure = envelope.error ?? (envelope.result as { error?: unknown } | undefined)?.error;
  if (failure !== undefined && failure !== null) {
    const text = describeError(failure);
    if (MISSING_PATTERN.test(text)) throw new ContractMissingError(contractId);
    throw new ContractPanicError(text, CODE_PATTERN.exec(text)?.[0] ?? null);
  }

  const bytes = (envelope.result as { result?: number[] } | undefined)?.result;
  if (!Array.isArray(bytes)) throw new RpcUnreachableError("RPC answer has no result");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))) as unknown;
}

/** Latest final block height, used by the health check. */
export async function blockHeight(options: RpcOptions = {}): Promise<number> {
  const envelope = await rpc("block", { finality: "final" }, options);
  const height = (envelope.result as { header?: { height?: number } } | undefined)?.header?.height;
  if (typeof height !== "number") throw new RpcUnreachableError("RPC answer has no block height");
  return height;
}
