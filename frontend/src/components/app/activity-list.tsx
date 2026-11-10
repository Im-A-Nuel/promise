"use client";

import type { CSSProperties } from "react";
import { findPersona } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { formatAgo, formatTusdc, shortAccount } from "@/lib/near/format";
import type { Activity, EventInvitation } from "@/lib/near/types";

function nameOf(account: string): string {
  const known = findPersona(account.split(".")[0]);
  return known && known.account_id === account ? known.name : shortAccount(account, 22);
}

/** The contract's own history of this event, newest first. Read from the chain, no indexer. */
export function ActivityList({ entries, invitations }: { entries: Activity[]; invitations: EventInvitation[] }) {
  const { t, locale } = useI18n();
  const now = Date.now();

  function guestOf(tokenId: number): string {
    return invitations.find((i) => i.token_id === tokenId)?.label ?? t("activity.a_guest");
  }

  return (
    <section aria-label={t("activity.title")} className="mt-10">
      <h2 className="mb-3 text-2xl">{t("activity.title")}</h2>
      {entries.length === 0 ? (
        <p className="surface p-4 text-ink-soft">{t("activity.empty")}</p>
      ) : (
        <ol className="surface divide-y divide-line p-2">
          {entries.map((e, i) => (
            <li
              key={e.idx}
              className="rise flex items-baseline justify-between gap-4 px-3 py-3"
              style={{ "--delay": `${Math.min(i, 8) * 40}ms` } as CSSProperties}
            >
              <span>
                {t(`activity.${e.kind}`, {
                  who: nameOf(e.actor),
                  guest: guestOf(e.token_id),
                  amount: formatTusdc(e.amount),
                })}
              </span>
              <time dateTime={new Date(e.at_ms).toISOString()} className="shrink-0 text-sm text-ink-soft">
                {formatAgo(e.at_ms, locale, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
