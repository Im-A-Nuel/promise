"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Pao, type PaoMood } from "@/components/pao";
import { Clouds } from "./clouds";
import { useI18n } from "@/lib/i18n/client";

const SLIDES = [
  { state: "invited", mood: "waiting" },
  { state: "sealed", mood: "sealed" },
  { state: "opened", mood: "opened" },
  { state: "repaid", mood: "repaid" },
] as const satisfies readonly { state: string; mood: PaoMood }[];

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <path d="M14.5 5.5 8 12l6.5 6.5" /> : <path d="M9.5 5.5 16 12l-6.5 6.5" />}
    </svg>
  );
}

/**
 * The four states of a card, told by Pao. Swipe on a phone, arrows or dots on a desktop, left and right
 * keys everywhere. The slide caption is real text, so the sequence reads without seeing the pictures.
 */
export function HeroCarousel() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (to: number) => {
      const el = track.current;
      if (!el) return;
      const next = Math.max(0, Math.min(SLIDES.length - 1, to));
      el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [reduce],
  );

  const onScroll = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = track.current;
      if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  }

  return (
    <section aria-roledescription="carousel" aria-label={t("carousel.label")} className="relative">
      <div
        ref={track}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[36px] focus-visible:outline-offset-4"
      >
        {SLIDES.map(({ state, mood }, i) => (
          <div
            key={state}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length}`}
            className="w-full shrink-0 snap-center"
          >
            <div className="relative mx-auto aspect-[5/4] w-full overflow-hidden rounded-[36px] bg-gradient-to-b from-[#FFEBDD] via-[#FFE2D3] to-[#FFF1E6] shadow-float">
              {/* warm light behind Pao */}
              <div aria-hidden="true" className="absolute left-1/2 top-[44%] h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,#FFF0B8_0%,rgba(255,240,184,0)_100%)]" />
              <Clouds className="absolute inset-x-0 bottom-0 h-[38%] w-full" />

              <span className="chip absolute left-4 top-4 bg-white/85">{t(`card.state.${state}`)}</span>

              <Pao mood={mood} label={t(`pao.${mood}`)} className="absolute bottom-[16%] left-1/2 w-[56%] -translate-x-1/2" />

              {/* handwritten note with an arrow pointing at Pao */}
              <p className="note absolute right-4 top-5 max-w-[9rem] -rotate-6 text-right sm:right-6 sm:top-7 sm:text-[1.5rem]">
                {t(`slide.${state}.note`)}
              </p>
              <svg aria-hidden="true" viewBox="0 0 60 44" className="absolute right-[24%] top-[26%] h-9 w-12 text-red-dark" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M52 4 C50 24 34 34 10 36" />
                <path d="M19 28 L9 36 L21 41" />
              </svg>
            </div>
            <p className="mx-auto mt-5 max-w-sm text-center text-ink-soft">{t(`states.${state}.body`)}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(index - 1)}
        disabled={index === 0}
        aria-label={t("carousel.prev")}
        className="glass absolute left-2 top-[34%] hidden h-11 w-11 place-items-center rounded-full text-red-dark disabled:opacity-0 md:grid"
      >
        <Arrow dir="left" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        disabled={index === SLIDES.length - 1}
        aria-label={t("carousel.next")}
        className="glass absolute right-2 top-[34%] hidden h-11 w-11 place-items-center rounded-full text-red-dark disabled:opacity-0 md:grid"
      >
        <Arrow dir="right" />
      </button>

      <div role="group" aria-label={t("carousel.dots")} className="mt-1 flex items-center justify-center">
        {SLIDES.map(({ state }, i) => (
          <button
            key={state}
            type="button"
            onClick={() => go(i)}
            aria-label={t("carousel.show", { state: t(`card.state.${state}`) })}
            aria-current={i === index}
            className="grid h-11 w-9 place-items-center"
          >
            <span className={`block h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-red" : "w-2.5 bg-[#e6cfc4]"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
