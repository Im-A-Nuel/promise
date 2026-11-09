import { NextResponse } from "next/server";
import { ContractMissingError, ContractPanicError, RpcUnreachableError } from "@/lib/near/provider";

/** Reads are cached for 10 seconds, as in docs/CLAUDE.md. Everything here is public chain data. */
const CACHE = "public, s-maxage=10, stale-while-revalidate=20";

export function ok(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: { "cache-control": CACHE } });
}

export function problem(code: "BAD_REQUEST" | "NOT_FOUND" | "RPC_ERROR" | "NOT_DEPLOYED" | "INTERNAL", message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Maps anything thrown by the near layer to the error format of docs/SCHEMA.md. */
export function fromError(error: unknown): NextResponse {
  if (error instanceof ContractMissingError) return problem("NOT_DEPLOYED", "The contract is not on testnet yet", 404);
  if (error instanceof RpcUnreachableError) return problem("RPC_ERROR", error.message, 502);
  if (error instanceof ContractPanicError) return problem("BAD_REQUEST", error.code ?? "The contract refused the request", 400);
  return problem("INTERNAL", "Unexpected error while reading the chain", 500);
}
