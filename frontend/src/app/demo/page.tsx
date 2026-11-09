import type { Metadata } from "next";
import { ChainStatus } from "@/components/chain-status";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

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
          <p className="mt-2 max-w-2xl text-ink-soft">{t("demo.walkthrough.lead")}</p>
          <ol className="surface mt-6 max-w-3xl divide-y divide-line p-2 sm:p-4">
            {STEPS.map((n) => (
              <li key={n} className="grid grid-cols-[2.75rem_1fr] items-start gap-x-3 px-2 py-4">
                <span aria-hidden="true" className="tabular grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-lg text-red-dark">
                  {n}
                </span>
                <span className="pt-1.5">{t(`demo.step.${n}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
