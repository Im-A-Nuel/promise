import Link from "next/link";
import { HeroCarousel } from "@/components/app/hero-carousel";
import { Shell } from "@/components/app/shell";
import { StatusPill } from "@/components/app/status-pill";
import { Pao, type PaoMood } from "@/components/pao";
import { Reveal } from "@/components/reveal";
import { getT } from "@/lib/i18n/server";

const STATES: { state: "invited" | "sealed" | "opened" | "repaid"; mood: PaoMood }[] = [
  { state: "invited", mood: "waiting" },
  { state: "sealed", mood: "sealed" },
  { state: "opened", mood: "opened" },
  { state: "repaid", mood: "repaid" },
];
const LEDGER_ROWS = [1, 2, 3, 4, 5] as const;
const LIMITS = [1, 2, 3, 4, 5] as const;

export default async function HomePage() {
  const { t } = await getT();

  return (
    <Shell>
      {/* Hero. On a phone: pill, headline, copy, the scene, dots, then the button. On a desktop: two columns. */}
      <section className="mx-auto grid max-w-6xl gap-x-12 gap-y-6 px-4 pb-14 pt-4 sm:px-6 lg:grid-cols-12 lg:pb-24 lg:pt-12">
        <div className="text-center lg:col-span-6 lg:row-start-1 lg:self-end lg:text-left">
          <StatusPill />
          <h1 className="mt-6 text-[2.6rem] sm:text-6xl lg:text-7xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft lg:mx-0 lg:max-w-lg lg:text-xl">{t("hero.lead")}</p>
        </div>

        <div className="lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:self-center">
          <HeroCarousel />
        </div>

        <div className="flex flex-col items-center gap-2 lg:col-span-6 lg:row-start-2 lg:items-start lg:self-start">
          <Link href="/demo" className="btn-primary w-full max-w-sm sm:w-auto">
            {t("hero.cta")}
          </Link>
          <a href="#ledger-story" className="flex min-h-[44px] items-center font-bold text-red-dark underline underline-offset-4">
            {t("hero.secondary")}
          </a>
        </div>
      </section>

      {/* The problem: one warm note card. */}
      <section className="px-4 sm:px-6">
        <Reveal className="surface mx-auto flex max-w-3xl flex-col items-center gap-6 p-7 sm:flex-row sm:p-10">
          <Pao mood="sealed" className="w-32 shrink-0 sm:w-40" />
          <div>
            <h2 className="text-3xl sm:text-4xl">{t("problem.title")}</h2>
            <p className="mt-4 text-lg">{t("problem.p1")}</p>
            <p className="mt-3 text-ink-soft">{t("problem.p2")}</p>
            <p className="mt-3 font-extrabold">{t("problem.p3")}</p>
          </div>
        </Reveal>
      </section>

      {/* The four states, one small Pao each. */}
      <section id="card" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-5xl">{t("states.title")}</h2>
          <p className="mt-4 text-lg text-ink-soft">{t("states.lead")}</p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {STATES.map(({ state, mood }, i) => (
            <li key={state}>
              <Reveal delay={i * 0.05} className="surface flex h-full items-center gap-5 p-5 sm:p-6">
                <Pao mood={mood} className="w-24 shrink-0 sm:w-28" />
                <div>
                  <h3 className="text-2xl">{t(`states.${state}.title`)}</h3>
                  <p className="mt-1 text-ink-soft">{t(`states.${state}.body`)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl text-center text-ink-soft">{t("states.refund")}</p>
      </section>

      {/* The ledger example. */}
      <section id="ledger-story" className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pb-28">
        <div className="lg:col-span-4">
          <h2 className="text-3xl sm:text-4xl">{t("ledger.title")}</h2>
          <p className="mt-4 text-lg text-ink-soft">{t("ledger.lead")}</p>
        </div>
        <div className="lg:col-span-8">
          <Reveal className="surface p-3 sm:p-5">
            <table className="w-full border-collapse text-left">
              <caption className="px-3 pb-3 text-left text-sm text-ink-soft">{t("ledger.caption")}</caption>
              <thead>
                <tr className="bg-blush">
                  <th scope="col" className="w-1/2 rounded-l-2xl px-3 py-3 font-display text-base font-semibold sm:text-lg">
                    {t("ledger.th.event")}
                  </th>
                  <th scope="col" className="rounded-r-2xl px-3 py-3 font-display text-base font-semibold sm:text-lg">
                    {t("ledger.th.result")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEDGER_ROWS.map((n) => (
                  <tr key={n} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-3.5">{t(`ledger.row${n}.event`)}</td>
                    <td className="tabular px-3 py-3.5 font-bold">{t(`ledger.row${n}.result`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-5 text-sm text-ink-soft">{t("ledger.footnote")}</p>
        </div>
      </section>

      {/* Limits, plain text. */}
      <section id="limits" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
        <h2 className="text-3xl sm:text-4xl">{t("limits.title")}</h2>
        <ul className="mt-8 gap-x-12 text-lg md:columns-2">
          {LIMITS.map((n) => (
            <li key={n} className="mb-5 flex break-inside-avoid gap-3">
              <span aria-hidden="true" className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
              {t(`limits.${n}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* The call to action. */}
      <section className="px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-[36px] bg-gradient-to-br from-[#FFE2D3] via-[#FFD8C7] to-[#FFEBD0] p-8 text-center shadow-float sm:flex-row sm:p-12 sm:text-left">
          <div className="flex-1">
            <h2 className="text-3xl sm:text-5xl">{t("cta.title")}</h2>
            <p className="mt-3 max-w-xl text-lg">{t("cta.body")}</p>
            <Link href="/demo" className="btn-primary mt-6">
              {t("cta.button")}
            </Link>
          </div>
          <Pao mood="repaid" className="w-40 shrink-0 sm:w-52" />
        </div>
      </section>
    </Shell>
  );
}
