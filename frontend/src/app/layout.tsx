import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

// Fraunces: soft serif, reads as printed invitation lettering. Inter: legible on a phone at the door,
// with tabular figures for money. Reasons are in DESIGN.md.
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"], display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Promise", template: "%s | Promise" },
  description:
    "Wedding envelopes as soulbound NFTs on NEAR testnet. The invitation holds the money until the event, then the contract keeps the ledger of gifts owed back.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF7F0",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
