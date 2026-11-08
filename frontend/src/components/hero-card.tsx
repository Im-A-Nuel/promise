"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { EnvelopeArt, type EnvelopeState } from "@/components/envelope-art";
import { useI18n } from "@/lib/i18n/client";

const ORDER: EnvelopeState[] = ["invited", "sealed", "opened", "repaid"];
const STEP_MS = 1700;

/**
 * Plays the four states of one card once and rests on the last. There is no loop. The list under
 * the card names every state, so the sequence is readable without seeing the animation.
 */
export function HeroCard() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const play = useCallback(() => {
    clear();
    setIndex(0);
    let step = 0;
    const next = () => {
      step += 1;
      setIndex(step);
      if (step < ORDER.length - 1) timer.current = setTimeout(next, STEP_MS);
    };
    timer.current = setTimeout(next, STEP_MS);
  }, [clear]);

  useEffect(() => {
    if (reduce) {
      setIndex(ORDER.length - 1);
      return clear;
    }
    play();
    return clear;
  }, [reduce, play, clear]);

  const state = ORDER[index] ?? "invited";
  const stateName = t(`card.state.${state}`);
  const guest = t("card.sample.guest");
  const done = state === "opened" || state === "repaid";
  const label = done
    ? t("card.alt_amount", { guest, state: stateName, amount: "5.00 tUSDC" })
    : t("card.alt", { guest, state: stateName });

  return (
    <figure className="m-0">
      <div className="relative mx-auto max-w-md drop-shadow-[0_10px_0_rgba(58,42,24,0.07)]">
        <div key={state} className={reduce ? undefined : "card-in"}>
          <EnvelopeArt
            id="hero-card"
            state={state}
            guest={guest}
            hajat={t("card.sample.hajat")}
            tokenNo={7}
            amount={done ? "5.00" : undefined}
            stamp={stateName}
            label={label}
          />
        </div>
      </div>

      <figcaption className="mx-auto mt-6 max-w-md">
        <ol className="flex justify-between border-t border-line pt-3 text-sm">
          {ORDER.map((item, i) => (
            <li
              key={item}
              aria-current={item === state ? "step" : undefined}
              className={`border-b-2 pb-1 ${
                item === state ? "border-red font-semibold text-ink" : i < index ? "border-transparent text-ink" : "border-transparent text-ink-soft"
              }`}
            >
              {t(`card.state.${item}`)}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-soft">{t("hero.caption")}</p>
        <button
          type="button"
          onClick={play}
          disabled={reduce === true}
          className="mt-2 min-h-[44px] text-sm font-semibold text-red underline underline-offset-4 hover:text-red-dark disabled:hidden"
        >
          {t("hero.replay")}
        </button>
      </figcaption>
    </figure>
  );
}
