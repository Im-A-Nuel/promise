"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { useI18n } from "@/lib/i18n/client";
import { usePersona } from "@/lib/persona";

type IconProps = { className?: string };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6 10.2V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1v-8.8" />
    </svg>
  );
}
function LedgerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
      <path d="M5 20V11M12 20V5M19 20v-6" />
    </svg>
  );
}
function EventsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="4" />
      <path d="M8.5 3.5v4M15.5 3.5v4M4 10.5h16" />
    </svg>
  );
}
function AccountIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M5 20c.7-3.6 3.5-5.6 7-5.6s6.3 2 7 5.6" />
    </svg>
  );
}

interface Item {
  href: string;
  key: "nav.home" | "nav.ledger" | "nav.events" | "nav.accounts";
  Icon: (p: IconProps) => ReactNode;
}

const ITEMS: Item[] = [
  { href: "/", key: "nav.home", Icon: HomeIcon },
  { href: "/ledger", key: "nav.ledger", Icon: LedgerIcon },
  { href: "/events", key: "nav.events", Icon: EventsIcon },
  { href: "/demo", key: "nav.accounts", Icon: AccountIcon },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The account the app acts as, shown as a small avatar. Links to the account screen. */
function AccountChip() {
  const { t } = useI18n();
  const { persona } = usePersona();
  return (
    <Link
      href="/demo"
      aria-label={persona ? `${t("account.change")}: ${persona.name}` : t("account.none")}
      className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 text-sm font-extrabold shadow-soft hover:bg-white sm:pr-4"
    >
      <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-peach font-display text-base text-red-dark">
        {persona ? persona.name.slice(0, 1) : "?"}
      </span>
      <span className="hidden sm:inline">{persona ? persona.name : t("account.none")}</span>
    </Link>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-cream/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex min-h-[44px] items-center gap-2.5">
          <Image src="/brand/mark-128.png" width={40} height={40} alt="" priority className="h-10 w-10" />
          <span className="font-display text-2xl font-semibold tracking-tight">{t("brand.name")}</span>
        </Link>

        <nav aria-label={t("nav.aria")} className="hidden items-center gap-1 lg:flex">
          {ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 font-bold ${
                  active ? "bg-blush text-red-dark" : "text-ink-soft hover:bg-white/70 hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <AccountChip />
          <LocaleSwitch />
        </div>
      </div>
    </header>
  );
}

/** Floating tab bar for phones and tablets. The header menu takes over from 1024 px. Icon plus word, so nothing relies on the icon alone. */
export function TabBar() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.aria")}
      className="glass fixed inset-x-3 bottom-3 z-40 mb-[env(safe-area-inset-bottom)] rounded-full p-1.5 lg:hidden"
    >
      <ul className="flex items-stretch justify-between">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-extrabold ${
                  active ? "bg-blush text-red-dark" : "text-ink-soft"
                }`}
              >
                <Icon className="h-6 w-6" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
