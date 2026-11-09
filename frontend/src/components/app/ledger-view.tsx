"use client";

import { useQuery } from "@tanstack/react-query";
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

/** One person on the ledger: who, how much, and how many envelopes are still open. */
function Row({ row }: { row: LedgerRow }) {
  const { t } = useI18n();
  const known = findPersona(row.counterparty.split(".")[0]);
  const name = known && known.account_id === row.counterparty ? known.name : shortAccount(row.counterparty, 22);
  return (
    <li className="surface flex items-center gap-4 p-4">
      <Avatar name={name} className="h-12 w-12 text-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl">{name}</p>
        <p className="truncate text-sm text-ink-soft">{row.counterparty}</p>
      </div>
      <div className="text-right">
        <p className="tabular font-display text-xl">{formatTusdc(row.remaining)}</p>
        <p className="text-sm text-ink-soft">{t("ledgerPage.open", { count: row.token_ids.length })}</p>
      </div>
    </li>
  );
}

function Section({ title, rows, none, tone }: { title: string; rows: LedgerRow[]; none: string; tone: "owe" | "owed" }) {
  const { t } = useI18n();
  return (
    <section aria-label={title} className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">{title}</h2>
        {rows.length > 0 && (
          <span className={`chip ${tone === "owed" ? "chip-good" : ""}`}>{t("ledgerPage.total", { amount: formatTusdc(total(rows)) })}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="surface p-4 text-ink-soft">{none}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <Row key={r.counterparty} row={r} />
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

  if (!ready) return <>{head}<Loading label={t("ledgerPage.loading")} /></>;
  if (!persona) {
    return (
      <>
        {head}
        <Empty title={t("ledgerPage.pick")} href="/demo" cta={t("ledgerPage.pick_cta")} />
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
      {query.isError && <ErrorBox message={t("ledgerPage.error")} onRetry={() => void query.refetch()} />}
      {query.data &&
        (query.data.i_owe.length === 0 && query.data.owed_to_me.length === 0 ? (
          <Empty mood="repaid" title={t("ledgerPage.empty")} />
        ) : (
          <>
            <Section title={t("ledgerPage.you_owe")} rows={query.data.i_owe} none={t("ledgerPage.none_owe")} tone="owe" />
            <Section title={t("ledgerPage.owed_to_you")} rows={query.data.owed_to_me} none={t("ledgerPage.none_owed")} tone="owed" />
          </>
        ))}
    </>
  );
}
