"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getJson, ApiError } from "@/lib/api-client";
import { findPersona } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, formatTusdc, shortAccount } from "@/lib/near/format";
import { eventSummarySchema, eventsSchema, type Hajat } from "@/lib/near/types";
import { Avatar, Empty, ErrorBox, Loading, PageTitle } from "./states";

function hostName(account: string): string {
  const known = findPersona(account.split(".")[0]);
  return known && known.account_id === account ? known.name : shortAccount(account, 22);
}

function StatusChip({ status }: { status: Hajat["status"] }) {
  const { t } = useI18n();
  return status === "Open" ? <span className="chip chip-good">{t("events.open")}</span> : <span className="chip chip-quiet">{t("events.cancelled")}</span>;
}

export function EventsList() {
  const { t, locale } = useI18n();
  const query = useQuery({ queryKey: ["events"], queryFn: () => getJson("/api/events", eventsSchema), refetchInterval: 20_000 });

  return (
    <>
      <PageTitle title={t("events.title")} lead={t("events.lead")} />
      {query.isPending && <Loading label={t("events.loading")} />}
      {query.isError && <ErrorBox message={t("events.error")} onRetry={() => void query.refetch()} />}
      {query.data && query.data.events.length === 0 && <Empty title={t("events.empty")} />}
      {query.data && query.data.events.length > 0 && (
        <ul className="grid gap-3">
          {query.data.events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="surface block p-5 transition-transform hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{t(`kind.${e.kind}`)}</span>
                  <StatusChip status={e.status} />
                  <span className="ml-auto text-sm text-ink-soft">{formatDate(e.event_at_ms, locale)}</span>
                </div>
                <h2 className="mt-3 text-2xl">{e.title}</h2>
                <p className="mt-1 text-ink-soft">{t("events.host", { host: hostName(e.host) })}</p>
                <p className="tabular mt-3 text-sm font-bold">
                  {t("events.invited", { count: e.invite_count })}
                  {" · "}
                  {t("events.released", { amount: formatTusdc(e.released_total) })}
                  {BigInt(e.sealed_total) > 0n && ` · ${t("events.waiting", { amount: formatTusdc(e.sealed_total) })}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function EventDetail() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;

  const query = useQuery({
    queryKey: ["event", id],
    queryFn: () => getJson(`/api/events/${id}`, eventSummarySchema),
    enabled: valid,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
    refetchInterval: 15_000,
  });

  const back = (
    <Link href="/events" className="mb-4 inline-flex min-h-[44px] items-center gap-2 font-bold text-red-dark">
      <span aria-hidden="true">&larr;</span>
      {t("event.back")}
    </Link>
  );

  if (!valid || (query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <>
        {back}
        <Empty title={t("event.not_found")} />
      </>
    );
  }

  return (
    <>
      {back}
      {query.isPending && <Loading label={t("event.loading")} />}
      {query.isError && <ErrorBox message={t("event.error")} onRetry={() => void query.refetch()} />}
      {query.data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{t(`kind.${query.data.hajat.kind}`)}</span>
            <StatusChip status={query.data.hajat.status} />
            <span className="ml-auto text-sm text-ink-soft">{formatDate(query.data.hajat.event_at_ms, locale)}</span>
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl">{query.data.hajat.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-ink-soft">
            <Avatar name={hostName(query.data.hajat.host)} className="h-8 w-8 text-sm" />
            {t("events.host", { host: hostName(query.data.hajat.host) })}
          </p>
          <p className="tabular mt-3 font-bold">
            {t("events.invited", { count: query.data.hajat.invite_count })}
            {" · "}
            {t("events.released", { amount: formatTusdc(query.data.hajat.released_total) })}
            {BigInt(query.data.hajat.sealed_total) > 0n && ` · ${t("events.waiting", { amount: formatTusdc(query.data.hajat.sealed_total) })}`}
          </p>

          <h2 className="mb-3 mt-10 text-2xl">{t("event.guests")}</h2>
          {query.data.invitations.length === 0 ? (
            <p className="surface px-5 py-4 text-ink-soft">{t("event.no_guests")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {query.data.invitations.map((inv) => {
                const status = t(`cardstatus.${inv.card_status}`);
                const amount = BigInt(inv.released) > 0n ? `, ${formatTusdc(inv.released)}` : "";
                return (
                  <li key={inv.token_id} className="surface overflow-hidden p-3">
                    {inv.media ? (
                      // The card is a data URI drawn by the contract, so it cannot go through next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={inv.media} alt={`${t("event.card_of", { name: inv.label })}, ${status}${amount}`} className="block h-auto w-full rounded-[20px]" />
                    ) : (
                      <div aria-hidden="true" className="skeleton aspect-[360/220]" />
                    )}
                    <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-3">
                      <p className="truncate font-display text-xl">{inv.label}</p>
                      <span className={`chip ${inv.card_status === "Repaid" || inv.card_status === "Reply" ? "chip-good" : ""}`}>{status}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
