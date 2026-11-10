"use client";

import { Pao } from "@/components/pao";
import { Page } from "@/components/app/states";
import { useI18n } from "@/lib/i18n/client";

/** Catches a crash inside a page. The header and tab bar stay, so there is always a way out. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <Page>
      <div role="alert" className="surface mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
        <Pao mood="waiting" className="w-36" />
        <h1 className="mt-4 text-2xl">{t("error.title")}</h1>
        <p className="mt-2 text-ink-soft">{t("error.body")}</p>
        <button type="button" onClick={reset} className="btn-primary mt-6">
          {t("chain.retry")}
        </button>
      </div>
    </Page>
  );
}
