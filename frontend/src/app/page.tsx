import Link from "next/link";
import { EnvelopeArt, type EnvelopeState } from "@/components/envelope-art";
import { HeroCard } from "@/components/hero-card";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";

const STATES: EnvelopeState[] = ["invited", "sealed", "opened", "repaid"];
const LEDGER_ROWS = [1, 2, 3, 4, 5] as const;
const LIMITS = [1, 2, 3, 4, 5] as const;

export default async function HomePage() {
  const { t } = await getT();

  return (
    <>
      <SiteHeader t={t} />
      <main id="content">
        {/* Hero: asymmetric. The headline carries the page, the card is the proof. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-12 lg:pb-28 lg:pt-20">
          <div className="lg:col-span-7">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">{t("hero.lead")}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link
                href="/demo"
                className="flex min-h-[48px] items-center rounded-input bg-red px-6 font-semibold text-white hover:bg-red-dark"
              >
                {t("hero.cta")}
              </Link>
              <a href="#ledger" className="flex min-h-[44px] items-center font-semibold underline underline-offset-4 hover:text-red">
                {t("hero.secondary")}
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <HeroCard />
          </div>
        </section>

        {/* The problem: set like a book page, a narrow column with a wide margin. */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-xl lg:ml-[25%]">
              <h2 className="text-3xl sm:text-4xl">{t("problem.title")}</h2>
              <p className="mt-6 font-display text-xl leading-snug sm:text-2xl">{t("problem.p1")}</p>
              <p className="mt-6 text-lg text-ink-soft">{t("problem.p2")}</p>
              <p className="mt-6 text-lg font-semibold">{t("problem.p3")}</p>
            </div>
          </div>
        </section>

        {/* The four states: a sequence, so the cards step down the page instead of sitting in a grid. */}
        <section id="card" className="border-t border-line bg-paper-deep">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl">{t("states.title")}</h2>
              <p className="mt-5 text-lg text-ink-soft">{t("states.lead")}</p>
            </div>

            <ol className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:[&>li:nth-child(2)]:mt-10 lg:[&>li:nth-child(3)]:mt-20 lg:[&>li:nth-child(4)]:mt-[7.5rem]">
              {STATES.map((state, i) => {
                const name = t(`card.state.${state}`);
                const done = state === "opened" || state === "repaid";
                return (
                  <li key={state}>
                    <Reveal delay={i * 0.06}>
                      <div className="drop-shadow-[0_8px_0_rgba(58,42,24,0.07)]">
                        <EnvelopeArt
                          id={`state-${state}`}
                          state={state}
                          guest={t("card.sample.guest")}
                          hajat={t("card.sample.hajat")}
                          tokenNo={7}
                          amount={done ? "5.00" : undefined}
                          stamp={name}
                          label={
                            done
                              ? t("card.alt_amount", { guest: t("card.sample.guest"), state: name, amount: "5.00 tUSDC" })
                              : t("card.alt", { guest: t("card.sample.guest"), state: name })
                          }
                        />
                      </div>
                      <h3 className="mt-5 text-2xl">{t(`states.${state}.title`)}</h3>
                      <p className="mt-2 text-ink-soft">{t(`states.${state}.body`)}</p>
                    </Reveal>
                  </li>
                );
              })}
            </ol>

            <p className="mt-16 max-w-2xl border-t border-line pt-5 text-ink-soft">{t("states.refund")}</p>
          </div>
        </section>

        {/* The ledger: the only place the guest-book ruled lines appear. */}
        <section id="ledger" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-4">
              <h2 className="text-3xl sm:text-4xl">{t("ledger.title")}</h2>
              <p className="mt-5 text-lg text-ink-soft">{t("ledger.lead")}</p>
            </div>

            <div className="lg:col-span-8">
              <Reveal>
                <table className="w-full border-collapse text-left">
                  <caption className="pb-4 text-left text-sm text-ink-soft">{t("ledger.caption")}</caption>
                  <thead>
                    <tr className="border-b-2 border-gold">
                      <th scope="col" className="w-1/2 py-3 pr-4 font-display text-lg font-semibold">
                        {t("ledger.th.event")}
                      </th>
                      <th scope="col" className="py-3 font-display text-lg font-semibold">
                        {t("ledger.th.result")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEDGER_ROWS.map((n) => (
                      <tr key={n} className={`border-b border-line align-top ${n > 3 ? "bg-paper-deep" : ""}`}>
                        <td className="py-4 pr-4">{t(`ledger.row${n}.event`)}</td>
                        <td className="tabular py-4 font-semibold">{t(`ledger.row${n}.result`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Reveal>
              <p className="mt-6 text-sm text-ink-soft">{t("ledger.footnote")}</p>
            </div>
          </div>
        </section>

        {/* Limits: plain text in two columns, no cards and no icons. */}
        <section id="limits" className="border-t border-line bg-paper-deep">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <h2 className="text-3xl sm:text-4xl">{t("limits.title")}</h2>
            <ul className="mt-10 gap-x-12 text-lg md:columns-2">
              {LIMITS.map((n) => (
                <li key={n} className="mb-6 break-inside-avoid border-t border-line pt-4">
                  {t(`limits.${n}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl rounded-card bg-red px-6 py-12 text-white sm:px-12 sm:py-16">
            <h2 className="max-w-2xl text-3xl sm:text-4xl">{t("cta.title")}</h2>
            <p className="mt-4 max-w-xl text-lg">{t("cta.body")}</p>
            <Link
              href="/demo"
              className="mt-8 inline-flex min-h-[48px] items-center rounded-input bg-paper px-6 font-semibold text-red-dark hover:bg-paper-deep"
            >
              {t("cta.button")}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
