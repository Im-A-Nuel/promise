"use client";

import { useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir === "left" ? (
        <path d="M14.5 5.5 8 12l6.5 6.5" />
      ) : (
        <path d="M9.5 5.5 16 12l-6.5 6.5" />
      )}
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
  // Autoplay. It stops for the pointer, for focus, for a touch, for a hidden tab, and when the carousel is off screen.
  const [playing, setPlaying] = useState(true);
  const section = useRef<HTMLElement>(null);
  const indexRef = useRef(0);
  const hovering = useRef(false);
  const visible = useRef(true);
  const lastTouch = useRef(0);

  const go = useCallback(
    (to: number) => {
      const el = track.current;
      if (!el) return;
      const next = Math.max(0, Math.min(SLIDES.length - 1, to));
      el.scrollTo({
        left: next * el.clientWidth,
        behavior: reduce ? "auto" : "smooth",
      });
    },
    [reduce],
  );

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !playing) return;
    const timer = setInterval(() => {
      if (hovering.current || document.hidden || !visible.current) return;
      if (Date.now() - lastTouch.current < 12_000) return;
      go((indexRef.current + 1) % SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [reduce, playing, go]);

  const touched = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);

  const onScroll = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = track.current;
      if (el && el.clientWidth > 0)
        setIndex(Math.round(el.scrollLeft / el.clientWidth));
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
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label={t("carousel.label")}
      className="relative"
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
      onPointerDown={touched}
      onFocus={() => {
        hovering.current = true;
        touched();
      }}
      onBlur={() => (hovering.current = false)}
    >
      <div
        ref={track}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        aria-live={playing && !reduce ? "off" : "polite"}
        tabIndex={0}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[36px] focus-visible:outline-offset-4"
      >
        {SLIDES.map(({ state, mood }, i) => (
          <div
            key={state}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${SLIDES.length}`}
            data-active={i === index}
            className="slide w-full shrink-0 snap-center"
          >
            <div className="slide-stage relative mx-auto aspect-[5/4] w-full overflow-hidden rounded-[36px] bg-gradient-to-b from-[#FFEBDD] via-[#FFE2D3] to-[#FFF1E6] shadow-float">
              {/* warm light behind Pao */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-[44%] h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,#FFF0B8_0%,rgba(255,240,184,0)_100%)]"
              />
              <Clouds className="absolute inset-x-0 bottom-0 h-[38%] w-full" />

              <span className="chip absolute left-4 top-4 bg-white/85">
                {t(`card.state.${state}`)}
              </span>

              <Pao
                mood={mood}
                label={t(`pao.${mood}`)}
                priority={i === 0}
                className="pao-pop absolute bottom-[14%] left-1/2 w-[60%] -translate-x-1/2"
              />

              {/* handwritten note with an arrow pointing at Pao */}
              <p className="note absolute right-4 top-5 max-w-[9rem] -rotate-6 text-right sm:right-6 sm:top-7 sm:text-[1.5rem]">
                {t(`slide.${state}.note`)}
              </p>
              <svg
                aria-hidden="true"
                viewBox="0 0 60 44"
                className="absolute right-[24%] top-[26%] h-9 w-12 text-red-dark"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M52 4 C50 24 34 34 10 36" />
                <path d="M19 28 L9 36 L21 41" />
              </svg>
            </div>
            <p className="mx-auto mt-5 max-w-sm text-center text-ink-soft">
              {t(`states.${state}.body`)}
            </p>
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

      <div className="mt-1 flex items-center justify-center gap-1">
        <div
          role="group"
          aria-label={t("carousel.dots")}
          className="flex items-center justify-center"
        >
          {SLIDES.map(({ state }, i) => (
            <button
              key={state}
              type="button"
              onClick={() => go(i)}
              aria-label={t("carousel.show", {
                state: t(`card.state.${state}`),
              })}
              aria-current={i === index}
              className="grid h-11 w-11 place-items-center"
            >
              <span
                className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 ease-[var(--ease-out)] ${i === index ? "w-6 bg-red" : "w-2.5 bg-[#e6cfc4]"}`}
              />
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("carousel.pause") : t("carousel.play")}
            className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-white/70 hover:text-red-dark"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="currentColor"
            >
              {playing ? (
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              ) : (
                <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z" />
              )}
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
