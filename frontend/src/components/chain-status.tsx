"use client";

import { StatusPill } from "@/components/app/status-pill";
import { useI18n } from "@/lib/i18n/client";
import { explorerAccountUrl } from "@/lib/near/format";
import { useHealth } from "@/lib/use-health";

/** Whether testnet answers and where the Promise contracts live. */
export function ChainStatus() {
  const { t } = useI18n();
  const { data, isError, refetch, isFetching } = useHealth();

  return (
    <section className="surface p-6">
      <StatusPill />
      {isError && (
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="btn-soft ml-3 disabled:opacity-60">
          {t("chain.retry")}
        </button>
      )}
      {data && !data.deployed && <p className="mt-3">{t("chain.not_deployed")}</p>}
      {data?.deployed && (
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-soft">{t("chain.block")}</dt>
          <dd className="tabular">{data.block_height}</dd>
          <dt className="text-ink-soft">{t("chain.amplop")}</dt>
          <dd>
            <a className="link break-all" href={explorerAccountUrl(data.amplop)}>
              {data.amplop}
            </a>
          </dd>
          <dt className="text-ink-soft">{t("chain.ft")}</dt>
          <dd>
            <a className="link break-all" href={explorerAccountUrl(data.ft)}>
              {data.ft}
            </a>
          </dd>
        </dl>
      )}
    </section>
  );
}
