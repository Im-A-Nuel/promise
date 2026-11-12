import Link from "next/link";
import type { CSSProperties } from "react";
import { LedgerStory, Limits } from "@/components/app/home-story";
import { HeroCarousel } from "@/components/app/hero-carousel";
import { StatusPill } from "@/components/app/status-pill";
import { Pao, type PaoMood } from "@/components/pao";
import { Reveal } from "@/components/reveal";
import { RiseWords } from "@/components/rise-words";
import { getT } from "@/lib/i18n/server";

const STATES: {
  state: "invited" | "sealed" | "opened" | "repaid";
  mood: PaoMood;
}[] = [
  { state: "invited", mood: "waiting" },
  { state: "sealed", mood: "sealed" },
  { state: "opened", mood: "opened" },
  { state: "repaid", mood: "repaid" },
];

export default async function HomePage() {
  const { t } = await getT();

  return (
    <>
      {/* Hero. On a phone: pill, headline, copy, the button, then the scene and its dots. On a desktop: two columns. */}
      <section className="mx-auto grid max-w-6xl gap-x-12 gap-y-6 px-4 pb-14 pt-4 sm:px-6 lg:grid-cols-12 lg:pb-24 lg:pt-12">
        <div className="text-center lg:col-span-6 lg:row-start-1 lg:self-end lg:text-left">
          <div className="hero-in" style={{ "--hd": "0ms" } as CSSProperties}>
            <StatusPill />
          </div>
          <h1 className="mt-6 text-[2.6rem] sm:text-6xl lg:text-7xl">
            <RiseWords text={t("hero.title")} />
          </h1>
          <p
            className="hero-in mx-auto mt-4 max-w-md text-lg text-ink-soft lg:mx-0 lg:max-w-lg lg:text-xl"
            style={{ "--hd": "520ms" } as CSSProperties}
          >
            {t("hero.lead")}
          </p>
        </div>

        {/* On a phone the button comes before the scene (order-3), so the first screen already shows what to press. */}
        <div
          className="hero-in order-3 lg:order-none lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:self-center"
          style={{ "--hd": "250ms" } as CSSProperties}
        >
          <div className="hero-drift">
            <HeroCarousel />
          </div>
        </div>

        <div
          className="hero-in order-2 flex flex-col items-center gap-2 lg:order-none lg:col-span-6 lg:row-start-2 lg:items-start lg:self-start"
          style={{ "--hd": "680ms" } as CSSProperties}
        >
          <Link href="/demo" className="btn-primary w-full max-w-sm sm:w-auto">
            {t("hero.cta")}
          </Link>
          <a
            href="#ledger-story"
            className="link flex min-h-[44px] items-center"
          >
            {t("hero.secondary")}
          </a>
        </div>
      </section>

      {/* The problem: one warm note card. */}
      <section className="px-4 sm:px-6">
        <Reveal className="surface mx-auto flex max-w-3xl flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
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
      <section
        id="card"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-5xl">{t("states.title")}</h2>
          <p className="mt-4 text-lg text-ink-soft">{t("states.lead")}</p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {STATES.map(({ state, mood }, i) => (
            <li key={state}>
              <Reveal
                delay={i * 0.05}
                className="surface flex h-full items-center gap-5 p-6"
              >
                <Pao mood={mood} className="w-24 shrink-0 sm:w-28" />
                <div>
                  <h3 className="text-2xl">{t(`states.${state}.title`)}</h3>
                  <p className="mt-1 text-ink-soft">
                    {t(`states.${state}.body`)}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl text-center text-ink-soft">
          {t("states.refund")}
        </p>
      </section>

      <LedgerStory />

      <Limits />

      {/* The call to action. */}
      <section className="px-4 sm:px-6">
        <Reveal className="mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-[36px] bg-gradient-to-br from-[#FFE2D3] via-[#FFD8C7] to-[#FFEBD0] p-8 text-center shadow-float sm:flex-row sm:text-left">
          <div className="flex-1">
            <h2 className="text-3xl sm:text-5xl">{t("cta.title")}</h2>
            <p className="mt-3 max-w-xl text-lg">{t("cta.body")}</p>
            <Link href="/demo" className="btn-primary mt-6">
              {t("cta.button")}
            </Link>
          </div>
          <Pao mood="repaid" className="w-40 shrink-0 sm:w-52" />
        </Reveal>
      </section>
    </>
  );
}
