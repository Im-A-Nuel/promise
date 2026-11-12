"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Pao, type PaoMood } from "@/components/pao";
import { PixelArt } from "@/components/pixel";
import { avatarLook, avatarSprite } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n/client";

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {lead && <p className="mt-2 max-w-xl text-lg text-ink-soft">{lead}</p>}
    </div>
  );
}

/** An empty state with Pao, a sentence and, when there is a next step, one button. */
export function Empty({ mood = "waiting", title, body, href, cta }: { mood?: PaoMood; title: string; body?: string; href?: string; cta?: string }) {
  return (
    <div className="surface mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
      <Pao mood={mood} className="w-36" />
      <h2 className="mt-4 text-2xl">{title}</h2>
      {body && <p className="mt-2 text-ink-soft">{body}</p>}
      {href && cta && (
        <Link href={href} className="btn-primary mt-6">
          {cta}
        </Link>
      )}
    </div>
  );
}

/** Shimmering placeholders. `label` is read aloud, the blocks themselves are decoration. */
export function Loading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="skeleton h-24" />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="surface mx-auto flex max-w-md flex-col items-center px-6 py-8 text-center">
      <Pao mood="oops" className="mb-2 w-24" />
      <p className="font-bold">{message}</p>
      <button type="button" onClick={onRetry} className="btn-soft mt-4">
        {t("chain.retry")}
      </button>
    </div>
  );
}

/**
 * A pixel person for an account. `seed` is the account id when the caller has it, so two accounts with the same
 * display name still look different. The name is already printed next to the picture, so it stays decorative.
 */
export function Avatar({ name, seed, className = "" }: { name: string; seed?: string; className?: string }) {
  const { sprite, palette } = avatarSprite(avatarLook(name, seed));
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden rounded-full bg-peach ${className}`}>
      <PixelArt sprite={sprite} palette={palette} scale={1} className="absolute bottom-0 left-1/2 h-auto w-[92%] -translate-x-1/2" />
    </span>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-8">{children}</div>;
}
