import type { Metadata } from "next";
import { ChainStatus } from "@/components/chain-status";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return { title: t("demo.title") };
}

export default async function DemoPage() {
  const { t } = await getT();

  return (
    <>
      <SiteHeader t={t} />
      <main id="content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <h1 className="text-4xl sm:text-5xl">{t("demo.title")}</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">{t("demo.lead")}</p>

        <div className="mt-8 max-w-2xl">
          <ChainStatus />
        </div>

        <div className="mt-12">
          <PersonaSwitcher />
        </div>

        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-3xl">{t("demo.walkthrough.title")}</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">{t("demo.walkthrough.lead")}</p>
          <ol className="mt-8 max-w-3xl">
            {STEPS.map((n) => (
              <li key={n} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-line py-4">
                <span className="tabular font-display text-2xl font-semibold text-red" aria-hidden="true">
                  {n}
                </span>
                <span>{t(`demo.step.${n}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
