"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/client";
import { createHajat } from "@/lib/near/actions";
import { MAX_EVENT_AHEAD_MS, MAX_TITLE, MAX_VENUE } from "@/lib/near/rules";
import { hajatKind, type HajatKind, type JoinPolicy } from "@/lib/near/types";
import { usePersona } from "@/lib/persona";
import { Avatar, Empty } from "./states";
import { useTx } from "./tx-provider";

const HOUR_MS = 3_600_000;
/** The contract compares against block time. A little margin keeps a slow local clock from failing it. */
const MIN_LEAD_MS = 5 * 60_000;

/** A Date as the value of an <input type="datetime-local"> in the user's own time zone. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewEventForm() {
  const { t } = useI18n();
  const { persona, ready } = usePersona();
  const { act, busy } = useTx();
  const router = useRouter();
  const ids = { title: useId(), kind: useId(), venue: useId(), when: useId() };

  // 12 hours ahead, so check-in (which opens 24 hours before) works straight away in the demo.
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<HajatKind>("Wedding");
  const [venue, setVenue] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(Date.now() + 12 * HOUR_MS));
  const [policy, setPolicy] = useState<JoinPolicy>("InviteOnly");
  const [touched, setTouched] = useState(false);

  if (!ready) return null;
  if (!persona) {
    return <Empty title={t("eventnew.need_account")} href="/demo" cta={t("ledgerPage.pick_cta")} />;
  }

  const whenMs = new Date(when).getTime();
  const now = Date.now();
  const titleOk = title.trim().length >= 1 && [...title.trim()].length <= MAX_TITLE;
  const venueOk = [...venue.trim()].length <= MAX_VENUE;
  const whenOk = Number.isFinite(whenMs) && whenMs >= now + MIN_LEAD_MS && whenMs <= now + MAX_EVENT_AHEAD_MS;
  const valid = titleOk && venueOk && whenOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    const result = await act({
      label: t("act.creating"),
      successKey: "act.created",
      call: createHajat({ title, kind, venue, eventAtMs: whenMs, policy }),
    });
    const created = result ? Number(result.value) : NaN;
    if (Number.isInteger(created) && created > 0) router.push(`/events/${created}`);
  }

  const err = (ok: boolean, key: string) => (touched && !ok ? t(key, { max: MAX_TITLE }) : null);

  return (
    <form onSubmit={submit} noValidate className="surface grid gap-5 p-5 sm:p-7">
      <p className="flex items-center gap-2 text-ink-soft">
        <Avatar name={persona.name} className="h-8 w-8 text-sm" />
        {t("eventnew.host_as", { name: persona.name })}
      </p>

      <div className="grid gap-1.5">
        <label htmlFor={ids.title} className="text-sm font-extrabold">
          {t("eventnew.title_label")}
        </label>
        <input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={touched && !titleOk} aria-describedby={`${ids.title}-error`} className="input" />
        {err(titleOk, "eventnew.title_bad") && (
          <p id={`${ids.title}-error`} role="alert" className="text-sm font-bold text-red-dark">
            {err(titleOk, "eventnew.title_bad")}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={ids.kind} className="text-sm font-extrabold">
          {t("eventnew.kind")}
        </label>
        <select id={ids.kind} value={kind} onChange={(e) => setKind(e.target.value as HajatKind)} className="input">
          {hajatKind.options.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={ids.venue} className="text-sm font-extrabold">
          {t("eventnew.venue")}
        </label>
        <input id={ids.venue} value={venue} onChange={(e) => setVenue(e.target.value)} aria-invalid={!venueOk} className="input" />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={ids.when} className="text-sm font-extrabold">
          {t("eventnew.when")}
        </label>
        <input id={ids.when} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={touched && !whenOk} aria-describedby={`${ids.when}-hint`} className="input" />
        <p id={`${ids.when}-hint`} className={`text-sm ${touched && !whenOk ? "font-bold text-red-dark" : "text-ink-soft"}`} role={touched && !whenOk ? "alert" : undefined}>
          {touched && !whenOk ? t("eventnew.when_bad") : t("eventnew.when_hint")}
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-extrabold">{t("eventnew.policy")}</legend>
        {(["InviteOnly", "OpenLink"] as const).map((p) => (
          <label key={p} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[18px] border-2 px-4 ${policy === p ? "border-red bg-blush/60" : "border-line bg-white"}`}>
            <input type="radio" name="policy" value={p} checked={policy === p} onChange={() => setPolicy(p)} className="h-5 w-5 accent-[#9b1c1c]" />
            {t(p === "InviteOnly" ? "eventnew.invite_only" : "eventnew.open_link")}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {t("eventnew.submit")}
        </button>
        <Link href="/events" className="btn-soft">
          {t("event.back")}
        </Link>
      </div>
    </form>
  );
}
