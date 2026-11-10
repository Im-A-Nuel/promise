import type { Metadata } from "next";
import { DemoSteps } from "@/components/app/demo-steps";
import { ChainStatus } from "@/components/chain-status";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("demo.title") };
}

export default async function DemoPage() {
  const { t } = await getT();

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-8">
        <h1 className="text-4xl sm:text-5xl">{t("demo.title")}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">{t("demo.lead")}</p>

        <div className="mt-6 max-w-2xl">
          <ChainStatus />
        </div>

        <div className="mt-10">
          <PersonaSwitcher />
        </div>

        <section className="mt-16">
          <h2 className="text-3xl">{t("demo.walkthrough.title")}</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {t("demo.walkthrough.lead")}
          </p>
          <DemoSteps />
        </section>
      </div>
    </>
  );
}
