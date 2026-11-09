import type { Metadata, Viewport } from "next";
import { Caveat, Fredoka, Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

// Fredoka: round and friendly like the shapes. Nunito: rounded terminals, easy on a phone, has
// tabular figures for amounts. Caveat: only for the short handwritten notes next to Pao.
const display = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const sans = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const note = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Promise", template: "%s | Promise" },
  description:
    "Wedding red envelopes as soulbound NFTs on NEAR testnet. The invitation holds the money until the event, then the contract keeps the ledger of gifts owed back.",
  applicationName: "Promise",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFF8F1",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable} ${note.variable}`}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
