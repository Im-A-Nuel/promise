"use client";

import Link from "next/link";
import { Avatar } from "@/components/app/states";
import { personas } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { explorerAccountUrl } from "@/lib/near/format";
import { usePersona } from "@/lib/persona";

/** Picks which demo account the app acts as. Once chosen, the ledger and events open from it. */
export function PersonaSwitcher() {
  const { locale, t } = useI18n();
  const { persona, select } = usePersona();

  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => {
          const active = p.id === persona?.id;
          return (
            <li key={p.id} className={`surface flex flex-col p-6 ${active ? "ring-[3px] ring-red" : ""}`}>
              <div className="flex items-center gap-3">
                <Avatar name={p.name} seed={p.account_id} className="h-12 w-12" />
                <div>
                  <h3 className="text-2xl">{p.name}</h3>
                  <p className="text-sm font-bold text-ink-soft">{p.role[locale]}</p>
                </div>
              </div>
              <p className="mt-3 flex-1">{p.blurb[locale]}</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-1.5 break-all text-sm text-ink-soft">
                {t("persona.account")}:
                <a className="link inline-flex min-h-[44px] items-center" href={explorerAccountUrl(p.account_id)}>
                  {p.account_id}
                </a>
              </p>
              {active ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/ledger" className="btn-soft">
                    {t("nav.ledger")}
                  </Link>
                  <Link href="/events" className="btn-soft">
                    {t("nav.events")}
                  </Link>
                </div>
              ) : (
                <button type="button" aria-pressed={false} onClick={() => select(p.id)} className="btn-primary btn-sm mt-4 w-full">
                  {t("demo.use", { name: p.name })}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-ink-soft" aria-live="polite">
        {persona ? t("demo.selected_line", { name: persona.name }) : t("demo.none_selected")}
      </p>
    </div>
  );
}
