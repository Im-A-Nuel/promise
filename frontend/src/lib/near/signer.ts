import { env } from "@/lib/env";
import type { Persona } from "@/lib/demo/personas";
import type { CallArgs } from "@/lib/near/actions";
import { extractErrorCode } from "@/lib/near/errors";
import { explorerTxUrl } from "@/lib/near/format";
import { ContractPanicError, RpcUnreachableError } from "@/lib/near/provider";

export interface TxResult {
  txHash: string;
  explorerUrl: string;
  /** parsed return value of the last receipt, when there is one */
  value: unknown;
  /** every log line of every receipt, events included */
  logs: string[];
}

/**
 * Whatever signs: a demo persona today, a real wallet later. Pages and components only know this
 * interface, never which one they got (docs/FRONTEND.md section 7).
 */
export interface AppSigner {
  readonly kind: "demo" | "wallet";
  readonly accountId: string | null;
  call(args: CallArgs): Promise<TxResult>;
}

const DEFAULT_GAS = 100n * 10n ** 12n;

type NearModule = typeof import("near-api-js");
type KeyPairString = import("near-api-js").KeyPairString;

/** Looks like a network failure and not an answer from the chain, so another endpoint may help. */
function isTransport(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /fetch|network|failed to|timeout|abort|ECONN|503|502|504/i.test(text) && !/ERR_|Smart contract/i.test(text);
}

/**
 * Signs in the browser with the key of a demo persona. The keys are public on purpose and control
 * testnet accounts that hold only test tokens. It never asks for approval, so every call goes straight out.
 */
export class DemoSigner implements AppSigner {
  readonly kind = "demo" as const;

  constructor(private readonly persona: Persona) {}

  get accountId(): string {
    return this.persona.account_id;
  }

  async call(args: CallArgs): Promise<TxResult> {
    const secret = this.persona.secret_key;
    if (!secret) throw new Error("This demo account has no key yet. Run pnpm deploy:testnet first.");

    // Say so at once instead of waiting for the retries of a request that cannot leave the device.
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new RpcUnreachableError("The device is offline");

    // near-api-js is large, so it is only loaded when someone actually signs.
    const near = await import("near-api-js");
    try {
      return await this.send(near, env.rpcUrl, secret, args);
    } catch (error) {
      if (!isTransport(error)) throw error;
      try {
        return await this.send(near, env.rpcFallbackUrl, secret, args);
      } catch (second) {
        if (isTransport(second)) throw new RpcUnreachableError("Neither testnet endpoint answered");
        throw second;
      }
    }
  }

  private async send(near: NearModule, rpcUrl: string, secret: string, args: CallArgs): Promise<TxResult> {
    // The library default is 12 retries, which is minutes of a frozen screen. Two is enough, the second endpoint is the real fallback.
    const provider = new near.JsonRpcProvider({ url: rpcUrl }, { retries: 2, wait: 500, backoff: 2 });
    const signer = near.KeyPairSigner.fromSecretKey(secret as KeyPairString);
    const account = new near.Account(this.persona.account_id, provider, signer);

    const res = await account.callFunctionRaw({
      contractId: args.contractId,
      methodName: args.method,
      args: args.args,
      deposit: args.deposit ?? 0n,
      gas: args.gas ?? DEFAULT_GAS,
      waitUntil: "FINAL",
    });

    const status = res.status as unknown;
    if (typeof status === "object" && status !== null && "Failure" in status) {
      const text = JSON.stringify((status as { Failure: unknown }).Failure);
      throw new ContractPanicError(text, extractErrorCode(text));
    }

    let value: unknown = null;
    try {
      value = near.getTransactionLastResult(res);
    } catch {
      value = null;
    }
    const txHash = res.transaction.hash as string;
    return {
      txHash,
      explorerUrl: explorerTxUrl(txHash),
      value,
      logs: res.receipts_outcome.flatMap((o) => o.outcome.logs),
    };
  }
}
