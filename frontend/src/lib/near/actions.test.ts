import { describe, expect, it } from "vitest";
import { IDLE, isBusy, txReducer, type TxState } from "@/lib/tx-state";
import { cancelHajat, checkIn, createHajat, invite, isTestnetAccount, join, noteTooLong, refund, seal, validateSeal } from "@/lib/near/actions";
import { toFriendlyError } from "@/lib/near/errors";
import { ContractPanicError, TxProblemError } from "@/lib/near/provider";
import { ABANDON_MS, OPEN_WINDOW_MS, SEAL_UNTIL_MS, canCancel, canCheckIn, canRefund, canSeal, checkInOpensAt } from "@/lib/near/rules";
import { findProblem } from "@/lib/near/tx-logs";

const AMPLOP = "amplop.promisedemo.testnet";
const FT = "tusdc.promisedemo.testnet";
const EVENT = 1_800_000_000_000;
const open = { event_at_ms: EVENT, status: "Open" as const };
const cancelled = { event_at_ms: EVENT, status: "Cancelled" as const };

describe("call builders", () => {
  it("seals through tUSDC with the message the contract expects", () => {
    const call = seal({ tokenId: 7, amount: "5000000", note: "  Selamat ya  " });
    expect(call.contractId).toBe(FT);
    expect(call.method).toBe("ft_transfer_call");
    expect(call.deposit).toBe(1n);
    expect(call.gas).toBe(100n * 10n ** 12n);
    expect(call.args).toMatchObject({ receiver_id: AMPLOP, amount: "5000000" });
    expect(JSON.parse(String(call.args.msg))).toEqual({ token_id: "7", note: "Selamat ya" });
  });

  it("leaves the note out when it is empty", () => {
    const call = seal({ tokenId: 7, amount: "10000", note: "   " });
    expect(JSON.parse(String(call.args.msg))).toEqual({ token_id: "7" });
  });

  it("passes the token id as a string, as the contract needs", () => {
    expect(JSON.parse(String(seal({ tokenId: 12, amount: "10000" }).args.msg)).token_id).toBe("12");
  });

  it("checks in with at least the minimum gas the contract demands", () => {
    const call = checkIn(3);
    expect(call).toMatchObject({ contractId: AMPLOP, method: "check_in", args: { token_id: 3 } });
    expect(call.gas).toBeGreaterThanOrEqual(120n * 10n ** 12n);
  });

  it("refunds with at least the refund gas floor", () => {
    expect(refund(3).gas).toBeGreaterThanOrEqual(80n * 10n ** 12n);
  });

  it("attaches the documented deposits", () => {
    const milli = 10n ** 21n;
    expect(createHajat({ title: " Party ", kind: "Wedding", venue: "", eventAtMs: EVENT, policy: "InviteOnly" }).deposit).toBeGreaterThanOrEqual(20n * milli);
    expect(invite({ hajatId: 1, guest: " a.testnet ", label: " A " }).deposit).toBeGreaterThanOrEqual(10n * milli);
    expect(join({ hajatId: 1, label: "Me" }).deposit).toBeGreaterThanOrEqual(10n * milli);
    expect(cancelHajat(1).deposit).toBeUndefined();
  });

  it("trims text and keeps the contract's field names", () => {
    expect(createHajat({ title: "  Party  ", kind: "Birth", venue: " Hall ", eventAtMs: EVENT, policy: "OpenLink" }).args).toEqual({
      title: "Party",
      kind: "Birth",
      venue: "Hall",
      event_at_ms: EVENT,
      join_policy: "OpenLink",
    });
    expect(invite({ hajatId: 4, guest: " budi.promisedemo.testnet ", label: " Budi " }).args).toEqual({
      hajat_id: 4,
      guest: "budi.promisedemo.testnet",
      label: "Budi",
    });
  });
});

describe("seal validation", () => {
  it("accepts a normal amount within the balance", () => {
    expect(validateSeal("5", 100_000_000n)).toEqual({ units: "5000000", problem: null });
    expect(validateSeal("0.01", null)).toEqual({ units: "10000", problem: null });
  });
  it("explains what is wrong", () => {
    expect(validateSeal("abc", null).problem).toBe("bad");
    expect(validateSeal("", null).problem).toBe("bad");
    expect(validateSeal("0.0000001", null).problem).toBe("bad");
    expect(validateSeal("0.009", null).problem).toBe("min");
    expect(validateSeal("0.00", null).problem).toBe("min");
    expect(validateSeal("500", 100_000_000n).problem).toBe("low");
  });
  it("counts characters, not bytes, for the 140 note limit", () => {
    expect(noteTooLong("a".repeat(140))).toBe(false);
    expect(noteTooLong("a".repeat(141))).toBe(true);
    expect(noteTooLong("é".repeat(140))).toBe(false);
  });
  it("accepts only real testnet accounts", () => {
    expect(isTestnetAccount("budi.promisedemo.testnet")).toBe(true);
    expect(isTestnetAccount("someone.near")).toBe(false);
    expect(isTestnetAccount("testnet")).toBe(false);
    expect(isTestnetAccount("BAD.testnet")).toBe(false);
    expect(isTestnetAccount("a b.testnet")).toBe(false);
  });
});

describe("time rules", () => {
  it("opens check in 24 hours before the event, inclusive", () => {
    const inv = { state: "Sealed" as const };
    expect(checkInOpensAt(open)).toBe(EVENT - OPEN_WINDOW_MS);
    expect(canCheckIn(open, inv, EVENT - OPEN_WINDOW_MS - 1)).toBe(false);
    expect(canCheckIn(open, inv, EVENT - OPEN_WINDOW_MS)).toBe(true);
  });
  it("only checks in invitations that are not opened yet", () => {
    for (const state of ["Opening", "Opened", "Refunding", "Refunded"] as const) expect(canCheckIn(open, { state }, EVENT)).toBe(false);
    expect(canCheckIn(open, { state: "Invited" }, EVENT)).toBe(true);
    expect(canCheckIn(cancelled, { state: "Sealed" }, EVENT)).toBe(false);
  });
  it("closes sealing 24 hours after the event", () => {
    const inv = { state: "Invited" as const };
    expect(canSeal(open, inv, EVENT + SEAL_UNTIL_MS - 1)).toBe(true);
    expect(canSeal(open, inv, EVENT + SEAL_UNTIL_MS)).toBe(false);
    expect(canSeal(cancelled, inv, EVENT)).toBe(false);
    expect(canSeal(open, { state: "Opened" }, EVENT)).toBe(false);
  });
  it("allows a refund after a cancel, or 30 days after the event", () => {
    const sealed = { state: "Sealed" as const };
    expect(canRefund(cancelled, sealed, EVENT)).toBe(true);
    expect(canRefund(open, sealed, EVENT + ABANDON_MS - 1)).toBe(false);
    expect(canRefund(open, sealed, EVENT + ABANDON_MS)).toBe(true);
    expect(canRefund(cancelled, { state: "Invited" }, EVENT)).toBe(false);
    expect(canRefund(cancelled, { state: "Opened" }, EVENT)).toBe(false);
  });
  it("blocks cancelling once an envelope is opened or opening", () => {
    expect(canCancel(open, [{ state: "Sealed" }, { state: "Invited" }])).toBe(true);
    expect(canCancel(open, [{ state: "Sealed" }, { state: "Opened" }])).toBe(false);
    expect(canCancel(open, [{ state: "Opening" }])).toBe(false);
    expect(canCancel(cancelled, [])).toBe(false);
  });
});

describe("receipts that fail quietly", () => {
  it("catches a soft rejection of a seal", () => {
    const problem = findProblem(["Transfer 5000000 from budi to amplop", "ERR_TOO_SMALL", "Refund 5000000"]);
    expect(problem).toBeInstanceOf(ContractPanicError);
    expect(toFriendlyError(problem).key).toBe("err.ERR_TOO_SMALL");
  });
  it("catches an open that could not pay the host", () => {
    const line = 'EVENT_JSON:{"standard":"promise_amplop","version":"1.0.0","event":"open_failed","data":[{}]}';
    const problem = findProblem([line]);
    expect(problem).toBeInstanceOf(TxProblemError);
    expect(toFriendlyError(problem).key).toBe("err.OPEN_FAILED");
  });
  it("catches a refund that could not pay the owner", () => {
    expect(toFriendlyError(findProblem(['EVENT_JSON:{"event":"refund_failed","data":[{}]}'])).key).toBe("err.REFUND_FAILED");
  });
  it("ignores normal events and unrelated lines", () => {
    expect(findProblem(['EVENT_JSON:{"event":"sealed","data":[{}]}', "EVENT_JSON:not json", "just a log"])).toBeNull();
    expect(findProblem([])).toBeNull();
  });
  it("does not mistake a longer message for a bare code", () => {
    expect(findProblem(["note: ERR_TOO_SMALL is the code for dust"])).toBeNull();
  });
});

describe("transaction state machine", () => {
  const start = txReducer(IDLE, { type: "start", label: "Sealing" });

  it("walks idle, signing, pending, confirming, done", () => {
    expect(start).toEqual({ status: "signing", label: "Sealing" });
    const pending = txReducer(start, { type: "sent" });
    expect(pending.status).toBe("pending");
    const confirming = txReducer(pending, { type: "confirming" });
    expect(confirming.status).toBe("confirming");
    const done = txReducer(confirming, { type: "done", explorerUrl: "https://x/tx", successKey: "act.sealed" });
    expect(done).toEqual({ status: "done", label: "Sealing", explorerUrl: "https://x/tx", successKey: "act.sealed" });
  });
  it("cannot start a second transaction while one is running", () => {
    expect(txReducer(start, { type: "start", label: "Other" })).toBe(start);
    expect(isBusy(start)).toBe(true);
  });
  it("can fail from any busy state and then be dismissed", () => {
    const failed = txReducer(txReducer(start, { type: "sent" }), { type: "fail", key: "err.ERR_BAD_STATE", code: "ERR_BAD_STATE" });
    expect(failed).toEqual({ status: "error", label: "Sealing", key: "err.ERR_BAD_STATE", code: "ERR_BAD_STATE" });
    expect(txReducer(failed, { type: "dismiss" })).toEqual(IDLE);
  });
  it("does not let a running transaction be dismissed", () => {
    expect(txReducer(start, { type: "dismiss" })).toBe(start);
  });
  it("ignores stray actions in the idle state", () => {
    const idle: TxState = IDLE;
    expect(txReducer(idle, { type: "sent" })).toBe(idle);
    expect(txReducer(idle, { type: "done", explorerUrl: "x", successKey: "y" })).toBe(idle);
    expect(txReducer(idle, { type: "fail", key: "k", code: null })).toBe(idle);
  });
});
