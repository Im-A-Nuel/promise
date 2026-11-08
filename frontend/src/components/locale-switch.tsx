"use client";

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
    <div role="group" aria-label={t("locale.label")} className="flex items-center rounded-input border border-line">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={code === locale}
          aria-label={t(`locale.${code}`)}
          onClick={() => choose(code)}
          className={`min-h-[44px] min-w-[44px] px-3 text-sm font-semibold first:rounded-l-[11px] last:rounded-r-[11px] ${
            code === locale ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
          }`}
        >
          {SHORT[code]}
        </button>
      ))}
    </div>
  );
}
