import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { LOCALE_COOKIE, isLocale, makeT, type Locale, type Translate } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : env.defaultLocale;
}

export async function getT(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
