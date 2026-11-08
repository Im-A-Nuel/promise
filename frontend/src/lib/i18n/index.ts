import en from "@/i18n/en.json";
import id from "@/i18n/id.json";

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export type MessageKey = keyof typeof en;
export type Dictionary = Record<string, string>;

export const LOCALE_COOKIE = "locale";

export const dictionaries: Record<Locale, Dictionary> = { en, id };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Looks up a message. Missing keys fall back to English, then to the key itself,
 * and log a warning outside production.
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
  dicts: Record<Locale, Dictionary> = dictionaries,
): string {
  const own = dicts[locale][key];
  if (own !== undefined) return fill(own, vars);

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
  }
  const fallback = dicts.en[key];
  return fill(fallback ?? key, vars);
}

export type Translate = (key: MessageKey | (string & {}), vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): Translate {
  return (key, vars) => translate(locale, key, vars);
}
