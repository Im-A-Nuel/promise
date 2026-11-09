/** The state machine of one transaction, as in docs/FRONTEND.md section 8. */
export type TxState =
  | { status: "idle" }
  | { status: "signing" | "pending" | "confirming"; label: string }
  | { status: "done"; label: string; explorerUrl: string; successKey: string }
  | { status: "error"; label: string; key: string; code: string | null };

export type TxAction =
  | { type: "start"; label: string }
  | { type: "sent" }
  | { type: "confirming" }
  | { type: "done"; explorerUrl: string; successKey: string }
  | { type: "fail"; key: string; code: string | null }
  | { type: "dismiss" };

export const IDLE: TxState = { status: "idle" };

export function isBusy(state: TxState): boolean {
  return state.status === "signing" || state.status === "pending" || state.status === "confirming";
}

export function txReducer(state: TxState, action: TxAction): TxState {
  switch (action.type) {
    case "start":
      return isBusy(state) ? state : { status: "signing", label: action.label };
    case "sent":
      return state.status === "signing" ? { status: "pending", label: state.label } : state;
    case "confirming":
      return state.status === "pending" || state.status === "signing" ? { status: "confirming", label: state.label } : state;
    case "done":
      return isBusy(state) && "label" in state
        ? { status: "done", label: state.label, explorerUrl: action.explorerUrl, successKey: action.successKey }
        : state;
    case "fail":
      return "label" in state ? { status: "error", label: state.label, key: action.key, code: action.code } : state;
    case "dismiss":
      return isBusy(state) ? state : IDLE;
  }
}
