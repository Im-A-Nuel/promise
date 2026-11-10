"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { Pao } from "@/components/pao";
import { useI18n } from "@/lib/i18n/client";
import type { CallArgs } from "@/lib/near/actions";
import { toFriendlyError } from "@/lib/near/errors";
import { TxTimeoutError } from "@/lib/near/provider";
import type { TxResult } from "@/lib/near/signer";
import { findProblem } from "@/lib/near/tx-logs";
import { IDLE, isBusy, txReducer, type TxState } from "@/lib/tx-state";
import { useSigner } from "@/lib/use-signer";

interface RunOptions {
  /** already translated, shown while the transaction runs */
  label: string;
  /** i18n key of the message shown when it worked */
  successKey: string;
  call: CallArgs;
  /** query key prefixes to refresh once the chain has the change */
  invalidate?: QueryKey[];
}

interface TxContextValue {
  state: TxState;
  busy: boolean;
  /** Returns the result, or null when it failed (the error is shown by the toast) or nobody is signed in. */
  act: (options: RunOptions) => Promise<TxResult | null>;
  dismiss: () => void;
}

const TxContext = createContext<TxContextValue | null>(null);

/** Everything a screen refreshes after any write. Cheap, and always right. */
export const ALL_CHAIN_QUERIES: QueryKey[] = [
  ["event"],
  ["events"],
  ["ledger"],
  ["balance"],
];

/** A normal transaction is final in a few seconds. Past this the screen stops waiting and says so. */
const TX_DEADLINE_MS = 45_000;

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TxTimeoutError()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function TxProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(txReducer, IDLE);
  const stateRef = useRef<TxState>(IDLE);
  const queryClient = useQueryClient();
  const signer = useSigner();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const act = useCallback(
    async (options: RunOptions): Promise<TxResult | null> => {
      if (!signer || isBusy(stateRef.current)) return null;
      stateRef.current = txReducer(stateRef.current, {
        type: "start",
        label: options.label,
      });
      dispatch({ type: "start", label: options.label });
      try {
        const pending = signer.call(options.call);
        dispatch({ type: "sent" });
        const result = await withDeadline(pending, TX_DEADLINE_MS);
        const problem = findProblem(result.logs);
        if (problem) throw problem;
        dispatch({ type: "confirming" });
        await Promise.all(
          (options.invalidate ?? ALL_CHAIN_QUERIES).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
        dispatch({
          type: "done",
          explorerUrl: result.explorerUrl,
          successKey: options.successKey,
        });
        return result;
      } catch (error) {
        // A timeout does not mean it failed. Refresh anyway, so the screen shows whatever the chain ended up with.
        if (error instanceof TxTimeoutError) {
          void Promise.all(ALL_CHAIN_QUERIES.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        }
        const friendly = toFriendlyError(error);
        dispatch({ type: "fail", key: friendly.key, code: friendly.code });
        return null;
      }
    },
    [queryClient, signer],
  );

  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  const value = useMemo(
    () => ({ state, busy: isBusy(state), act, dismiss }),
    [state, act, dismiss],
  );

  return (
    <TxContext.Provider value={value}>
      {children}
      <TxToast />
    </TxContext.Provider>
  );
}

export function useTx(): TxContextValue {
  const value = useContext(TxContext);
  if (!value) throw new Error("useTx must be used inside TxProvider");
  return value;
}

/** The one place a user learns what their last action did. Reads aloud, links to NearBlocks, goes away by itself. */
function TxToast() {
  const { t } = useI18n();
  const ctx = useContext(TxContext);
  const live = ctx?.state ?? IDLE;
  const dismiss = ctx?.dismiss;
  // Keep the last message on screen while the card slides away, so it does not blank out mid-exit.
  const last = useRef<TxState>(live);
  if (live.status !== "idle") last.current = live;
  const state = live.status === "idle" ? last.current : live;

  useEffect(() => {
    if (live.status !== "done" || !dismiss) return;
    const timer = setTimeout(dismiss, 9000);
    return () => clearTimeout(timer);
  }, [live, dismiss]);

  if (state.status === "idle") return null;
  const visible = live.status !== "idle";

  const busy =
    state.status === "signing" ||
    state.status === "pending" ||
    state.status === "confirming";
  const mood =
    state.status === "done"
      ? "repaid"
      : state.status === "error"
        ? "waiting"
        : "sealed";

  let title: string;
  let detail: string | null = null;
  if (state.status === "error") {
    // A timeout is not a failure: the transaction may still land, so the title must not claim it did not work.
    title = state.key === "err.tx_timeout" ? t("tx.unconfirmed", { label: state.label }) : t("tx.failed", { label: state.label });
    detail = t(state.key);
  } else if (state.status === "done") {
    title = t(state.successKey);
  } else if (state.status === "confirming") {
    title = t("tx.confirming");
  } else if (state.status === "pending") {
    title = state.label;
    detail = t("tx.pending");
  } else {
    title = state.label;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className="surface fixed inset-x-3 bottom-24 bg-white z-50 flex items-center gap-3 p-3 pr-4 shadow-float lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[26rem]"
        >
          <Pao mood={mood} className="w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">{title}</p>
            {detail && (
              <p className="mt-0.5 text-sm text-ink-soft">
                {detail}
                {state.status === "error" && state.code ? (
                  <span className="ml-1 text-xs opacity-80">
                    ({state.code})
                  </span>
                ) : null}
              </p>
            )}
            {state.status === "done" && (
              <a
                href={state.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="link text-sm"
              >
                {t("tx.view")}
              </a>
            )}
          </div>
          {!busy && (
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("tx.dismiss")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-blush"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
