"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

const SHORT: Record<Locale, string> = { en: "EN", id: "ID" };

export function LocaleSwitch() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("locale.label")} className="flex items-center rounded-full bg-blush p-0.5">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={code === locale}
          aria-label={t(`locale.${code}`)}
          onClick={() => choose(code)}
          className={`relative min-h-[44px] min-w-[44px] rounded-full px-2 text-sm font-extrabold ${
            code === locale ? "text-white" : "text-red-dark hover:bg-white/60"
          }`}
        >
          {code === locale && (
            <motion.span
              layoutId="locale-pill"
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-red shadow-soft"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          )}
          <span className="relative">{SHORT[code]}</span>
        </button>
      ))}
    </div>
  );
}
