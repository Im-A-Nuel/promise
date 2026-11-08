import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <>
      <SiteHeader t={t} />
      <main id="content" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl sm:text-5xl">{t("notfound.title")}</h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">{t("notfound.body")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-[48px] items-center rounded-input bg-red px-6 font-semibold text-white hover:bg-red-dark"
        >
          {t("notfound.home")}
        </Link>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
