import { ContractPanicError, TxProblemError } from "@/lib/near/provider";

/**
 * Receipts can fail without failing the transaction. This looks for those cases in the logs:
 *  - a soft rejection of a seal: the contract logs the bare code (`ERR_TOO_SMALL`) and the tokens go back
 *  - `open_failed` and `refund_failed` events: the inner tUSDC transfer failed and the token stayed sealed
 * Returns the error to show, or null when everything went as intended.
 */
export function findProblem(logs: string[]): Error | null {
  for (const line of logs) {
    const bare = /^(ERR_[A-Z_]+)$/.exec(line.trim());
    if (bare?.[1]) return new ContractPanicError(bare[1], bare[1]);

    if (line.startsWith("EVENT_JSON:")) {
      try {
        const body = JSON.parse(line.slice("EVENT_JSON:".length)) as { event?: string };
        if (body.event === "open_failed") return new TxProblemError("err.OPEN_FAILED");
        if (body.event === "refund_failed") return new TxProblemError("err.REFUND_FAILED");
      } catch {
        // not one of ours, ignore
      }
    }
  }
  return null;
}
