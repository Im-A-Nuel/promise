import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getConfig } from "@/lib/near/contract";
import { ContractMissingError, RpcUnreachableError, blockHeight } from "@/lib/near/provider";

export const dynamic = "force-dynamic";

// GET /api/health: liveness and chain wiring. `deployed` is false until the contracts exist on testnet.
export async function GET() {
  try {
    const height = await blockHeight();
    let deployed = true;
    try {
      await getConfig();
    } catch (error) {
      if (error instanceof ContractMissingError) deployed = false;
      else throw error;
    }
    return NextResponse.json(
      { ok: true, network: env.network, amplop: env.amplopId, ft: env.ftId, block_height: height, deployed },
      { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch (error) {
    const message = error instanceof RpcUnreachableError ? error.message : "Unexpected error while reading the chain";
    return NextResponse.json({ error: { code: "RPC_ERROR", message } }, { status: 502 });
  }
}
