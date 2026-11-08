"use client";

import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/client";
import { explorerAccountUrl } from "@/lib/near/format";
import { healthSchema, type Health } from "@/lib/near/types";

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return healthSchema.parse(await res.json());
}

/** Shows whether testnet answers and whether the Promise contracts exist there. */
export function ChainStatus() {
  const { t } = useI18n();
  const { data, isPending, isError, refetch, isFetching } = useQuery({ queryKey: ["health"], queryFn: fetchHealth });

  return (
    <section aria-live="polite" className="rounded-card border border-line bg-paper-deep p-5">
      {isPending && <p className="text-ink-soft">{t("chain.checking")}</p>}

      {isError && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p>{t("chain.unreachable")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="min-h-[44px] rounded-input border border-ink px-4 text-sm font-semibold hover:bg-paper disabled:opacity-60"
          >
            {t("chain.retry")}
          </button>
        </div>
      )}

      {data && !data.deployed && <p>{t("chain.not_deployed")}</p>}

      {data?.deployed && (
        <div>
          <p>{t("chain.ok", { height: data.block_height })}</p>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-soft">{t("chain.amplop")}</dt>
            <dd>
              <a className="break-all underline underline-offset-4" href={explorerAccountUrl(data.amplop)}>
                {data.amplop}
              </a>
            </dd>
            <dt className="text-ink-soft">{t("chain.ft")}</dt>
            <dd>
              <a className="break-all underline underline-offset-4" href={explorerAccountUrl(data.ft)}>
                {data.ft}
              </a>
            </dd>
          </dl>
        </div>
      )}
    </section>
  );
}
