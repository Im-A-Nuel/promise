"use client";

import { useEffect, useState } from "react";
import { personas, findPersona } from "@/lib/demo/personas";
import { useI18n } from "@/lib/i18n/client";
import { explorerAccountUrl } from "@/lib/near/format";

const STORAGE_KEY = "promise:persona";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private windows can block storage. The selection then lasts for this visit only.
  }
}

/** Picks which demo account the app acts as. The choice is the only thing kept outside the chain. */
export function PersonaSwitcher() {
  const { locale, t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored();
    if (findPersona(stored)) setSelected(stored);
  }, []);

  function choose(id: string) {
    setSelected(id);
    writeStored(id);
  }

  const current = findPersona(selected);

  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => {
          const active = p.id === selected;
          return (
            <li
              key={p.id}
              className={`flex flex-col rounded-card border bg-paper p-5 ${active ? "border-2 border-red" : "border-line"}`}
            >
              <h3 className="text-2xl">{p.name}</h3>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{p.role[locale]}</p>
              <p className="mt-3 flex-1">{p.blurb[locale]}</p>
              <p className="mt-4 text-sm text-ink-soft">
                {t("persona.account")}:{" "}
                <a className="break-all underline underline-offset-4" href={explorerAccountUrl(p.account_id)}>
                  {p.account_id}
                </a>
              </p>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => choose(p.id)}
                className={`mt-4 min-h-[44px] rounded-input px-4 font-semibold ${
                  active ? "border border-red text-red-dark" : "bg-red text-white hover:bg-red-dark"
                }`}
              >
                {active ? t("demo.active") : t("demo.use", { name: p.name })}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-ink-soft" aria-live="polite">
        {current ? t("demo.selected_line", { name: current.name }) : t("demo.none_selected")}
      </p>
    </div>
  );
}
