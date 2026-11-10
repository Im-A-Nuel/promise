"use client";

import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { Pao } from "@/components/pao";
import { Amount, TusdcCoin } from "@/components/coin";
import { findPersona } from "@/lib/demo/personas";
import { getJson } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { formatTusdc, shortAccount } from "@/lib/near/format";
import { ledgerSchema, type LedgerRow } from "@/lib/near/types";
import { usePersona } from "@/lib/persona";
import { Avatar, Empty, ErrorBox, Loading, PageTitle } from "./states";

function total(rows: LedgerRow[]): bigint {
  return rows.reduce((sum, r) => sum + BigInt(r.remaining), 0n);
}

/** A small round badge with an arrow: money leaving (you owe) or coming (you are owed). */
function Direction({
  tone,
  className = "h-5 w-5",
}: {
  tone: "owe" | "owed";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full ring-2 ring-white ${className} ${tone === "owe" ? "bg-red text-white" : "bg-green text-white"}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[60%] w-[60%]"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tone === "owe" ? (
          <path d="M7 17 17 7M9 7h8v8" />
        ) : (
          <path d="M17 7 7 17M15 17H7V9" />
        )}
      </svg>
    </span>
  );
}

/** One person on the ledger: who, how much, and how many envelopes are still open. */
function Row({
  row,
  tone,
  index,
}: {
  row: LedgerRow;
  tone: "owe" | "owed";
  index: number;
}) {
  const { t } = useI18n();
  const known = findPersona(row.counterparty.split(".")[0]);
  const name =
    known && known.account_id === row.counterparty
      ? known.name
      : shortAccount(row.counterparty, 22);
  return (
    <li
      className="surface rise flex items-center gap-4 p-5"
      style={{ "--delay": `${Math.min(index, 8) * 60}ms` } as CSSProperties}
    >
      <span className="relative shrink-0">
        <Avatar name={name} className="h-14 w-14 text-2xl" />
        <Direction
          tone={tone}
          className="absolute -bottom-1 -right-1 h-6 w-6"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl">{name}</p>
        <p className="truncate text-sm text-ink-soft">{row.counterparty}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Amount units={row.remaining} size="md" showUnit={false} />
        <span className="chip">
          {t("ledgerPage.open", { count: row.token_ids.length })}
        </span>
      </div>
    </li>
  );
}

function Section({
  title,
  rows,
  none,
  tone,
}: {
  title: string;
  rows: LedgerRow[];
  none: string;
  tone: "owe" | "owed";
}) {
  const { t } = useI18n();
  return (
    <section aria-label={title} className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-2xl">
          <Direction tone={tone} className="h-8 w-8" />
          {title}
        </h2>
        {rows.length > 0 && (
          <span className={`chip ${tone === "owed" ? "chip-good" : ""}`}>
            <TusdcCoin className="h-4 w-4" />
            {t("ledgerPage.total", { amount: formatTusdc(total(rows)) })}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="surface flex items-center gap-4 p-4">
          <Pao
            mood={tone === "owe" ? "repaid" : "waiting"}
            animated={false}
            className="w-16 shrink-0"
          />
          <p className="text-ink-soft">{none}</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((r, i) => (
            <Row key={r.counterparty} row={r} tone={tone} index={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function LedgerView() {
  const { t } = useI18n();
  const { persona, ready } = usePersona();
  const account = persona?.account_id ?? null;

  const query = useQuery({
    queryKey: ["ledger", account],
    queryFn: () => getJson(`/api/ledger/${account}`, ledgerSchema),
    enabled: account !== null,
    refetchInterval: 15_000,
  });

  const title = t("ledgerPage.title");
  const head = <PageTitle title={title} lead={t("ledgerPage.lead")} />;

  if (!ready)
    return (
      <>
        {head}
        <Loading label={t("ledgerPage.loading")} />
      </>
    );
  if (!persona) {
    return (
      <>
        {head}
        <Empty
          title={t("ledgerPage.pick")}
          href="/demo"
          cta={t("ledgerPage.pick_cta")}
        />
      </>
    );
  }

  return (
    <>
      {head}
      <p className="mb-2 flex items-center gap-2 text-ink-soft">
        <Avatar name={persona.name} className="h-8 w-8 text-sm" />
        {t("ledgerPage.viewing", { name: persona.name })}
      </p>
      {query.isPending && <Loading label={t("ledgerPage.loading")} />}
      {query.isError && (
        <ErrorBox
          message={t("ledgerPage.error")}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data &&
        (query.data.i_owe.length === 0 && query.data.owed_to_me.length === 0 ? (
          <Empty mood="repaid" title={t("ledgerPage.empty")} />
        ) : (
          <>
            <Section
              title={t("ledgerPage.you_owe")}
              rows={query.data.i_owe}
              none={t("ledgerPage.none_owe")}
              tone="owe"
            />
            <Section
              title={t("ledgerPage.owed_to_you")}
              rows={query.data.owed_to_me}
              none={t("ledgerPage.none_owed")}
              tone="owed"
            />
          </>
        ))}
    </>
  );
}
