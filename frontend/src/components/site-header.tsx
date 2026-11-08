import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import type { Translate } from "@/lib/i18n";

/** The envelope mark: the card object reduced to its flap and seal. Placeholder until a logo is supplied. */
function Mark() {
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true" className="h-6 w-8">
      <rect x="1" y="3" width="30" height="20" rx="3" fill="#9B1C1C" />
      <polygon points="1,3 31,3 16,15" fill="#7A1414" />
      <circle cx="16" cy="14.5" r="3.2" fill="#C9A227" />
    </svg>
  );
}

export function SiteHeader({ t }: { t: Translate }) {
  const links = [
    { href: "/#card", label: t("nav.card") },
    { href: "/#ledger", label: t("nav.ledger") },
    { href: "/#limits", label: t("nav.limits") },
  ];

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-input focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
      >
        {t("nav.skip")}
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-h-[44px] items-center gap-3 font-display text-2xl font-semibold tracking-tight">
            <Mark />
            {t("brand.name")}
          </Link>

          <nav aria-label={t("nav.aria")} className="order-last flex w-full gap-5 text-sm sm:order-none sm:w-auto sm:text-base">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-[44px] items-center text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/demo"
              className="flex min-h-[44px] items-center font-semibold text-red underline underline-offset-4 sm:hidden"
            >
              {t("nav.demo")}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <LocaleSwitch />
            <Link
              href="/demo"
              className="hidden min-h-[44px] items-center rounded-input bg-red px-5 font-semibold text-white hover:bg-red-dark sm:flex"
            >
              {t("nav.demo")}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
