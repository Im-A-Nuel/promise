"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { personas } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { cancelHajat, checkIn, invite, isTestnetAccount, join, noteTooLong, refund, seal, validateSeal } from "@/lib/near/actions";
import { formatAmount, formatDateTime, formatTusdc } from "@/lib/near/format";
import { MAX_LABEL, MAX_NOTE, canCancel, canCheckIn, canRefund, checkInOpensAt } from "@/lib/near/rules";
import type { EventInvitation, Hajat } from "@/lib/near/types";
import { useTx } from "./tx-provider";

/** A labelled field. The error, when there is one, is tied to the input for screen readers. */
function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string | null; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-extrabold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-bold text-red-dark">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const PRESETS = [1, 5, 10] as const;

/** Seals tUSDC into the viewer's own invitation. Can be used again to add more before the event. */
export function SealForm({ invitation, suggested, balance }: { invitation: EventInvitation; suggested: bigint; balance: bigint | null }) {
  const { t } = useI18n();
  const { act, busy } = useTx();
  const amountId = useId();
  const noteId = useId();
  const [amount, setAmount] = useState(suggested > 0n ? formatAmount(suggested) : "");
  const [note, setNote] = useState("");

  const { units, problem } = validateSeal(amount, balance);
  const tooLong = noteTooLong(note);
  const showProblem = amount.trim() !== "" && problem !== null;
  const problemText = problem ? t(`seal.${problem}`) : null;
  const alreadySealed = BigInt(invitation.sealed) > 0n;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!units || tooLong || busy) return;
    const result = await act({
      label: t("act.sealing"),
      successKey: "act.sealed",
      call: seal({ tokenId: invitation.token_id, amount: units, note }),
    });
    if (result) setNote("");
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-[22px] bg-blush/60 p-4" aria-label={t("seal.title")}>
      <div>
        <h3 className="text-xl">{alreadySealed ? t("seal.add") : t("seal.title")}</h3>
        {alreadySealed && <p className="mt-0.5 text-sm text-ink-soft">{t("seal.so_far", { amount: formatTusdc(invitation.sealed) })}</p>}
        {suggested > 0n && <p className="mt-1 text-sm font-bold text-red-dark">{t("seal.owe_hint", { amount: formatTusdc(suggested) })}</p>}
      </div>

      <Field id={amountId} label={t("seal.amount")} error={showProblem ? problemText : null} hint={balance !== null ? t("seal.balance", { amount: formatTusdc(balance) }) : undefined}>
        <input
          id={amountId}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={showProblem}
          aria-describedby={showProblem ? `${amountId}-error` : `${amountId}-hint`}
          placeholder="5"
          className="input tabular"
        />
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("seal.presets")}>
        {suggested > 0n && (
          <button type="button" className="chip min-h-[44px] px-4" onClick={() => setAmount(formatAmount(suggested))}>
            {t("seal.payback", { amount: formatTusdc(suggested) })}
          </button>
        )}
        {PRESETS.map((p) => (
          <button key={p} type="button" className="chip min-h-[44px] px-4" onClick={() => setAmount(String(p))}>
            {p} tUSDC
          </button>
        ))}
      </div>

      <Field id={noteId} label={t("seal.note")} hint={t("seal.note_hint", { max: MAX_NOTE })} error={tooLong ? t("seal.note_long", { max: MAX_NOTE }) : null}>
        <textarea id={noteId} rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={tooLong} aria-describedby={tooLong ? `${noteId}-error` : `${noteId}-hint`} className="input py-3" />
      </Field>

      <button type="submit" disabled={!units || tooLong || busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
        {t("seal.submit")}
      </button>
    </form>
  );
}

/** The host marks a guest as present. A sealed envelope opens and the money moves to the host. */
export function CheckInButton({ hajat, invitation }: { hajat: Hajat; invitation: EventInvitation }) {
  const { t, locale } = useI18n();
  const { act, busy } = useTx();
  const allowed = canCheckIn(hajat, invitation, Date.now());
  const early = hajat.status === "Open" && (invitation.state === "Invited" || invitation.state === "Sealed") && !allowed;

  if (!allowed && !early) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={!allowed || busy}
        onClick={() => void act({ label: t("act.checking"), successKey: "act.checked_in", call: checkIn(invitation.token_id) })}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("checkin.button")}
      </button>
      {early && <p className="mt-1.5 text-center text-sm text-ink-soft">{t("checkin.early", { when: formatDateTime(checkInOpensAt(hajat), locale) })}</p>}
    </div>
  );
}

/** Anyone may press this. The money always goes to the owner of the invitation, never to the caller. */
export function RefundButton({ hajat, invitation }: { hajat: Hajat; invitation: EventInvitation }) {
  const { t } = useI18n();
  const { act, busy } = useTx();
  if (!canRefund(hajat, invitation, Date.now())) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void act({ label: t("act.refunding"), successKey: "act.refunded", call: refund(invitation.token_id) })}
      className="btn-soft mt-3 w-full disabled:opacity-50"
    >
      {t("refund.button", { name: invitation.label })}
    </button>
  );
}

/** Host only: invite one account. Demo accounts are offered, any testnet account can be typed. */
export function InviteForm({ hajat, owners }: { hajat: Hajat; owners: string[] }) {
  const { t } = useI18n();
  const { act, busy } = useTx();
  const accountId = useId();
  const labelId = useId();
  const listId = useId();
  const [account, setAccount] = useState("");
  const [label, setLabel] = useState("");

  const taken = owners.includes(account.trim());
  const accountOk = isTestnetAccount(account) && account.trim() !== hajat.host && !taken;
  const labelOk = label.trim().length >= 1 && [...label.trim()].length <= MAX_LABEL;
  const accountError = account.trim() !== "" && !accountOk ? (taken ? t("invite.taken") : account.trim() === hajat.host ? t("invite.self") : t("invite.bad_account")) : null;
  const suggestions = personas.filter((p) => p.account_id !== hajat.host && !owners.includes(p.account_id));

  function onAccount(value: string) {
    setAccount(value);
    const known = personas.find((p) => p.account_id === value.trim());
    if (known && label.trim() === "") setLabel(known.name);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountOk || !labelOk || busy) return;
    const result = await act({ label: t("act.inviting"), successKey: "act.invited", call: invite({ hajatId: hajat.id, guest: account, label }) });
    if (result) {
      setAccount("");
      setLabel("");
    }
  }

  return (
    <form onSubmit={submit} className="surface grid gap-3 p-5" aria-label={t("invite.title")}>
      <h3 className="text-2xl">{t("invite.title")}</h3>
      <Field id={accountId} label={t("invite.account")} hint={t("invite.hint")} error={accountError}>
        <input id={accountId} list={listId} value={account} onChange={(e) => onAccount(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={accountError !== null} placeholder="budi.promisedemo.testnet" className="input" />
        <datalist id={listId}>
          {suggestions.map((p) => (
            <option key={p.id} value={p.account_id}>
              {p.name}
            </option>
          ))}
        </datalist>
      </Field>
      <Field id={labelId} label={t("invite.label")}>
        <input id={labelId} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={MAX_LABEL * 2} className="input" />
      </Field>
      <button type="submit" disabled={!accountOk || !labelOk || busy} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
        {t("invite.submit")}
      </button>
    </form>
  );
}

/** Host only: cancel while nothing is opened. Two steps, because it cannot be undone. */
export function CancelControl({ hajat, invitations }: { hajat: Hajat; invitations: EventInvitation[] }) {
  const { t } = useI18n();
  const { act, busy } = useTx();
  const [asking, setAsking] = useState(false);
  const allowed = canCancel(hajat, invitations);

  if (!allowed) {
    return <p className="surface px-5 py-4 text-ink-soft">{t("cancel.blocked")}</p>;
  }
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="btn-soft w-full sm:w-auto">
        {t("cancel.button")}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t("cancel.button")} className="surface grid gap-3 p-5">
      <p className="font-bold">{t("cancel.warn")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const result = await act({ label: t("act.cancelling"), successKey: "act.cancelled", call: cancelHajat(hajat.id) });
            if (result) setAsking(false);
          }}
          className="btn-primary disabled:opacity-50"
        >
          {t("cancel.confirm")}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="btn-soft">
          {t("cancel.keep")}
        </button>
      </div>
    </div>
  );
}

/** For an open link event: the viewer joins and gets an invitation of their own. */
export function RsvpForm({ hajat, defaultLabel }: { hajat: Hajat; defaultLabel: string }) {
  const { t } = useI18n();
  const { act, busy } = useTx();
  const labelId = useId();
  const [label, setLabel] = useState(defaultLabel);
  const ok = label.trim().length >= 1 && [...label.trim()].length <= MAX_LABEL;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    await act({ label: t("act.joining"), successKey: "act.joined", call: join({ hajatId: hajat.id, label }) });
  }

  return (
    <form onSubmit={submit} className="surface grid gap-3 p-5" aria-label={t("join.title")}>
      <h3 className="text-2xl">{t("join.title")}</h3>
      <Field id={labelId} label={t("join.label")}>
        <input id={labelId} value={label} onChange={(e) => setLabel(e.target.value)} className="input" />
      </Field>
      <button type="submit" disabled={!ok || busy} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
        {t("join.submit")}
      </button>
    </form>
  );
}
