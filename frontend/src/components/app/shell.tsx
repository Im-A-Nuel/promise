import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { getT } from "@/lib/i18n/server";
import { SiteHeader, TabBar } from "./nav";

/** Header, content, footer and the phone tab bar. Pages render only their own sections. */
export async function Shell({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[14px] focus:bg-ink focus:px-4 focus:py-3 focus:text-cream"
      >
        {t("nav.skip")}
      </a>
      <SiteHeader />
      <main id="content" className="pb-6 lg:pb-12">
        {children}
      </main>
      <SiteFooter t={t} />
      <TabBar />
    </>
  );
}
