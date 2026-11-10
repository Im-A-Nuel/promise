"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getJson, ApiError } from "@/lib/api-client";
import { findPersona } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, formatTusdc, shortAccount } from "@/lib/near/format";
import { canSeal } from "@/lib/near/rules";
import {
  balanceSchema,
  eventSummarySchema,
  eventsSchema,
  type EventInvitation,
  type Hajat,
} from "@/lib/near/types";
import { usePersona } from "@/lib/persona";
import { ActivityList } from "./activity-list";
import { DoorPass } from "./door-pass";
import {
  CancelControl,
  CheckInButton,
  InviteForm,
  RefundButton,
  RsvpForm,
  SealForm,
} from "./event-actions";
import { Avatar, Empty, ErrorBox, Loading, PageTitle } from "./states";

function hostName(account: string): string {
  const known = findPersona(account.split(".")[0]);
  return known && known.account_id === account
    ? known.name
    : shortAccount(account, 22);
}

function StatusChip({ status }: { status: Hajat["status"] }) {
  const { t } = useI18n();
  return status === "Open" ? (
    <span className="chip chip-good">{t("events.open")}</span>
  ) : (
    <span className="chip chip-quiet">{t("events.cancelled")}</span>
  );
}

export function EventsList() {
  const { t, locale } = useI18n();
  const { persona } = usePersona();
  const query = useQuery({
    queryKey: ["events"],
    queryFn: () => getJson("/api/events", eventsSchema),
    refetchInterval: 20_000,
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-3 gap-y-4 sm:mb-8 [&>div]:mb-0">
        <PageTitle title={t("events.title")} lead={t("events.lead")} />
        <Link href="/events/new" className="btn-primary">
          {t("events.new")}
        </Link>
      </div>
      {!persona && (
        <p className="surface mb-4 p-4 text-ink-soft">
          {t("event.pick_account")}
        </p>
      )}
      {query.isPending && <Loading label={t("events.loading")} />}
      {query.isError && (
        <ErrorBox
          message={t("events.error")}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && query.data.events.length === 0 && (
        <Empty
          title={t("events.empty")}
          href="/events/new"
          cta={t("events.new")}
        />
      )}
      {query.data && query.data.events.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.events.map((e, i) => (
            <li
              key={e.id}
              className="rise"
              style={{ "--delay": `${Math.min(i, 8) * 50}ms` } as CSSProperties}
            >
              <Link
                href={`/events/${e.id}`}
                className="surface surface-link block h-full p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{t(`kind.${e.kind}`)}</span>
                  <StatusChip status={e.status} />
                </div>
                <h2 className="mt-3 text-2xl">{e.title}</h2>
                <p className="mt-1 text-ink-soft">
                  {formatDate(e.event_at_ms, locale)}
                  {" · "}
                  {t("events.host", { host: hostName(e.host) })}
                </p>
                <p className="tabular mt-3 text-sm font-bold">
                  {t("events.invited", { count: e.invite_count })}
                  {" · "}
                  {t("events.released", {
                    amount: formatTusdc(e.released_total),
                  })}
                  {BigInt(e.sealed_total) > 0n &&
                    ` · ${t("events.waiting", { amount: formatTusdc(e.sealed_total) })}`}
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
  const { persona } = usePersona();
  const params = useParams<{ id: string }>();
  const door = Number(useSearchParams().get("door"));
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const account = persona?.account_id ?? null;

  const query = useQuery({
    queryKey: ["event", id, account],
    queryFn: () =>
      getJson(
        `/api/events/${id}${account ? `?viewer=${account}` : ""}`,
        eventSummarySchema,
      ),
    enabled: valid,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 1,
    refetchInterval: 15_000,
  });
  const balance = useQuery({
    queryKey: ["balance", account],
    queryFn: () => getJson(`/api/balance/${account}`, balanceSchema),
    enabled: account !== null,
  });

  const back = (
    <Link
      href="/events"
      className="link mb-4 inline-flex min-h-[44px] items-center gap-2 no-underline"
    >
      <span aria-hidden="true">&larr;</span>
      {t("event.back")}
    </Link>
  );

  if (
    !valid ||
    (query.error instanceof ApiError && query.error.status === 404)
  ) {
    return (
      <>
        {back}
        <Empty title={t("event.not_found")} />
      </>
    );
  }

  const data = query.data;
  const hajat = data?.hajat;
  const isHost = hajat !== undefined && account === hajat.host;
  const mine = data?.invitations.find((i) => i.owner === account);
  const now = Date.now();
  const suggested = data?.suggested_reply ? BigInt(data.suggested_reply) : 0n;
  const tusdcBalance = balance.data ? BigInt(balance.data.tusdc) : null;

  return (
    <>
      {back}
      {query.isPending && <Loading label={t("event.loading")} />}
      {query.isError && (
        <ErrorBox
          message={t("event.error")}
          onRetry={() => void query.refetch()}
        />
      )}
      {data && hajat && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{t(`kind.${hajat.kind}`)}</span>
            <StatusChip status={hajat.status} />
            {isHost && (
              <span className="chip chip-quiet">{t("event.you_host")}</span>
            )}
            <span className="ml-auto text-sm text-ink-soft">
              {formatDate(hajat.event_at_ms, locale)}
            </span>
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl">{hajat.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-ink-soft">
            <Avatar name={hostName(hajat.host)} className="h-8 w-8 text-sm" />
            {t("events.host", { host: hostName(hajat.host) })}
          </p>
          <p className="tabular mt-3 font-bold">
            {t("events.invited", { count: hajat.invite_count })}
            {" · "}
            {t("events.released", {
              amount: formatTusdc(hajat.released_total),
            })}
            {BigInt(hajat.sealed_total) > 0n &&
              ` · ${t("events.waiting", { amount: formatTusdc(hajat.sealed_total) })}`}
          </p>

          {Number.isInteger(door) && door > 0 && (
            <DoorBanner
              hajat={hajat}
              isHost={isHost}
              signedIn={persona !== null}
              invitation={
                data.invitations.find((i) => i.token_id === door) ?? null
              }
            />
          )}

          {!persona && (
            <p className="surface mt-6 flex flex-wrap items-center gap-3 p-4">
              <span className="flex-1">{t("event.pick_account")}</span>
              <Link href="/demo" className="btn-soft">
                {t("ledgerPage.pick_cta")}
              </Link>
            </p>
          )}

          {persona && isHost && hajat.status === "Open" && (
            <section
              aria-label={t("event.host_tools")}
              className="mt-6 grid items-start gap-4 lg:grid-cols-2"
            >
              <InviteForm
                hajat={hajat}
                owners={data.invitations.map((i) => i.owner)}
              />
              <CancelControl hajat={hajat} invitations={data.invitations} />
            </section>
          )}

          {persona &&
            !isHost &&
            !mine &&
            hajat.join_policy === "OpenLink" &&
            hajat.status === "Open" && (
              <div className="mt-6">
                <RsvpForm hajat={hajat} defaultLabel={persona.name} />
              </div>
            )}

          <h2 className="mb-3 mt-10 text-2xl">{t("event.guests")}</h2>
          {data.invitations.length === 0 ? (
            <p className="surface p-4 text-ink-soft">{t("event.no_guests")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.invitations.map((inv) => {
                const status = t(`cardstatus.${inv.card_status}`);
                const amount =
                  BigInt(inv.released) > 0n
                    ? `, ${formatTusdc(inv.released)}`
                    : "";
                const isMine = inv.owner === account;
                return (
                  <li
                    key={inv.token_id}
                    className={`surface overflow-hidden p-3 ${isMine ? "ring-[3px] ring-red/70 sm:col-span-2 lg:col-span-3" : ""}`}
                  >
                    {inv.media ? (
                      // The card is a data URI drawn by the contract, so it cannot go through next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={inv.media}
                        alt={`${t("event.card_of", { name: inv.label })}, ${status}${amount}`}
                        className={`block h-auto w-full rounded-[20px] ${isMine ? "mx-auto max-w-md" : ""}`}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="skeleton aspect-[360/220]"
                      />
                    )}
                    <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-3">
                      <p className="truncate font-display text-xl">
                        {inv.label}
                        {isMine && (
                          <span className="ml-2 text-sm font-bold text-red-dark">
                            {t("event.you")}
                          </span>
                        )}
                      </p>
                      <span
                        className={`chip ${inv.card_status === "Repaid" || inv.card_status === "Reply" ? "chip-good" : ""}`}
                      >
                        {status}
                      </span>
                    </div>

                    {persona && (
                      <div className="px-1 pb-1">
                        {isMine && canSeal(hajat, inv, now) && (
                          <SealForm
                            invitation={inv}
                            suggested={suggested}
                            balance={tusdcBalance}
                          />
                        )}
                        {isMine &&
                          !canSeal(hajat, inv, now) &&
                          inv.state === "Invited" &&
                          hajat.status === "Open" && (
                            <p className="mt-3 text-sm text-ink-soft">
                              {t("seal.closed")}
                            </p>
                          )}
                        {isMine &&
                          inv.state !== "Opened" &&
                          hajat.status === "Open" && (
                            <DoorPass
                              hajatId={hajat.id}
                              tokenId={inv.token_id}
                            />
                          )}
                        {isHost && (
                          <CheckInButton hajat={hajat} invitation={inv} />
                        )}
                        <RefundButton hajat={hajat} invitation={inv} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ActivityList
            entries={data.activity}
            invitations={data.invitations}
          />
        </>
      )}
    </>
  );
}

/** Shown when the host opens a guest's door pass. Picks the guest out and puts the check-in button right here. */
function DoorBanner({
  hajat,
  isHost,
  signedIn,
  invitation,
}: {
  hajat: Hajat;
  isHost: boolean;
  signedIn: boolean;
  invitation: EventInvitation | null;
}) {
  const { t } = useI18n();
  if (!invitation)
    return (
      <p className="surface mt-6 p-4 text-ink-soft">{t("door.not_found")}</p>
    );
  return (
    <section
      aria-label={t("door.host_title", { name: invitation.label })}
      className="surface mt-6 grid gap-2 p-6 ring-[3px] ring-red/70"
    >
      <h2 className="text-2xl">
        {t("door.host_title", { name: invitation.label })}
      </h2>
      {isHost ? (
        <>
          <p className="text-ink-soft">{t("door.host_body")}</p>
          <CheckInButton hajat={hajat} invitation={invitation} />
        </>
      ) : (
        <p className="text-ink-soft">
          {signedIn ? t("door.not_host") : t("event.pick_account")}
        </p>
      )}
    </section>
  );
}
