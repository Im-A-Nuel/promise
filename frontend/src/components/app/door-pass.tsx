"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** The guest's pass for the door: a QR code that opens this event on the host's phone with the guest picked. */
export function DoorPass({ hajatId, tokenId }: { hajatId: number; tokenId: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open || src) return;
    const url = `${window.location.origin}/events/${hajatId}?door=${tokenId}`;
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 440, color: { dark: "#3a2a1a", light: "#ffffff" } })
      .then((data) => {
        if (alive) setSrc(data);
      })
      .catch(() => {
        if (alive) setOpen(false);
      });
    return () => {
      alive = false;
    };
  }, [open, src, hajatId, tokenId]);

  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="btn-soft btn-sm w-full">
        {open ? t("door.hide") : t("door.show")}
      </button>
      {open && (
        <div className="rise mt-3 grid justify-items-center gap-2 rounded-[22px] bg-white p-4 text-center">
          <p className="font-display text-lg">{t("door.title")}</p>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={t("door.alt")} width={220} height={220} className="h-[220px] w-[220px] rounded-[16px]" />
          ) : (
            <div aria-hidden="true" className="skeleton h-[220px] w-[220px]" />
          )}
          <p className="max-w-[16rem] text-sm text-ink-soft">{t("door.help")}</p>
        </div>
      )}
    </div>
  );
}
