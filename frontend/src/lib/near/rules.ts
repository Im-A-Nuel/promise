import type { Hajat, InvitationView } from "@/lib/near/types";

// Mirrors the time rules of docs/CONTRACTS.md section 4. The contract is the authority; these only decide
// which buttons to enable, so a user never presses one that is sure to fail.

const HOUR_MS = 3_600_000;
/** The host may check in from 24 hours before the event. */
export const OPEN_WINDOW_MS = 24 * HOUR_MS;
/** Sealing closes 24 hours after the event. */
export const SEAL_UNTIL_MS = 24 * HOUR_MS;
/** 30 days after the event, an owner may pull a still sealed envelope back. */
export const ABANDON_MS = 30 * 24 * HOUR_MS;
/** 0.01 tUSDC in base units. */
export const MIN_AMPLOP = 10_000n;
export const MAX_NOTE = 140;
export const MAX_TITLE = 80;
export const MAX_VENUE = 80;
export const MAX_LABEL = 40;
export const MAX_EVENT_AHEAD_MS = 365 * 24 * HOUR_MS;

type EventTimes = Pick<Hajat, "event_at_ms" | "status">;
type Card = Pick<InvitationView, "state">;

export function checkInOpensAt(h: EventTimes): number {
  return h.event_at_ms - OPEN_WINDOW_MS;
}

export function canCheckIn(h: EventTimes, inv: Card, now: number): boolean {
  return h.status === "Open" && (inv.state === "Invited" || inv.state === "Sealed") && now >= checkInOpensAt(h);
}

export function canSeal(h: EventTimes, inv: Card, now: number): boolean {
  return h.status === "Open" && (inv.state === "Invited" || inv.state === "Sealed") && now < h.event_at_ms + SEAL_UNTIL_MS;
}

export function canRefund(h: EventTimes, inv: Card, now: number): boolean {
  return inv.state === "Sealed" && (h.status === "Cancelled" || now >= h.event_at_ms + ABANDON_MS);
}

/** A host may cancel while no envelope is opened or opening. */
export function canCancel(h: Pick<Hajat, "status">, invs: Card[]): boolean {
  return h.status === "Open" && !invs.some((i) => i.state === "Opened" || i.state === "Opening");
}
