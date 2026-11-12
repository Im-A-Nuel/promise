"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Pao } from "@/components/pao";
import { findPersona } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { usePersona } from "@/lib/persona";
import { Avatar } from "./states";

/** Who acts in each step, and where the button takes you once you are signed in as them. */
const STEPS = [
  { n: 1, who: "ayu", go: "/events" },
  { n: 2, who: "dewi", go: "/events" },
  { n: 3, who: "ayu", go: "/events" },
  { n: 4, who: "ayu", go: "/ledger" },
  { n: 5, who: "budi", go: "/events" },
  { n: 6, who: "ayu", go: "/events" },
  { n: 7, who: "budi", go: "/events" },
] as const;

/** A soft tint per person, so the story can be followed by color as well as by name. */
const TINT: Record<string, string> = {
  ayu: "bg-peach",
  budi: "bg-mint",
  dewi: "bg-blush",
  citra: "bg-gold-soft",
  eko: "bg-line",
};

/**
 * The walkthrough as a timeline. Each step names who acts, says what happens, and has one button that
 * switches to that account and opens the screen where it happens, so following the story is a tap per step.
 */
export function DemoSteps() {
  const { t } = useI18n();
  const { persona, select } = usePersona();
  const router = useRouter();

  return (
    <div className="mt-8 grid items-start gap-10 lg:grid-cols-12">
      <ol className="lg:col-span-7">
        {STEPS.map(({ n, who, go }, i) => {
          const person = findPersona(who);
          const name = person?.name ?? who;
          const last = i === STEPS.length - 1;
          const here = persona?.id === who;
          return (
            <li
              key={n}
              className="rise grid grid-cols-[3.5rem_1fr] gap-x-4"
              style={{ "--delay": `${i * 70}ms` } as CSSProperties}
            >
              <div className="flex flex-col items-center">
                <span className="relative">
                  <Avatar
                    name={name}
                    seed={person?.account_id}
                    className={`h-14 w-14 ring-4 ring-cream ${TINT[who] ?? "bg-peach"}`}
                  />
                  <span
                    aria-hidden="true"
                    className="tabular absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-red font-display text-xs text-white ring-2 ring-cream"
                  >
                    {n}
                  </span>
                </span>
                {!last && (
                  <span
                    aria-hidden="true"
                    className="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-peach to-transparent"
                  />
                )}
              </div>

              <div
                className={`surface surface-link mb-5 p-5 ${here ? "ring-2 ring-red/40" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-ink-soft">
                    {t("demo.step.label", { n })}
                  </span>
                  <span className={`chip ${here ? "chip-good" : "chip-quiet"}`}>
                    {name}
                  </span>
                </div>
                <p className="mt-2">{t(`demo.step.${n}`)}</p>
                <button
                  type="button"
                  className="btn-soft btn-sm mt-4"
                  onClick={() => {
                    select(who);
                    router.push(go);
                  }}
                >
                  {t("demo.step.go", { name })}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Pao keeps watch beside the story, and looks wherever the pointer goes. */}
      <aside className="hidden lg:col-span-5 lg:block">
        <div className="surface sticky top-24 grid justify-items-center gap-2 bg-gradient-to-b from-[#FFEBDD] to-white p-8 text-center">
          <Pao mood="opened" label={t("demo.pao.label")} className="w-56" />
          <p className="note">{t("demo.pao.note")}</p>
        </div>
      </aside>
    </div>
  );
}
