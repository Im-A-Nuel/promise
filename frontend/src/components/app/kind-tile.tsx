import Image from "next/image";
import type { HajatKind } from "@/lib/near/types";

/** One clay picture per kind of event, made to match the Pao artwork. `Other` is a wrapped gift. */
const ART: Record<HajatKind, string> = {
  Wedding: "/art/kind-wedding.webp",
  Khitan: "/art/kind-khitan.webp",
  Birth: "/art/kind-birth.webp",
  Syukuran: "/art/kind-syukuran.webp",
  Duka: "/art/kind-duka.webp",
  Other: "/art/kind-gift.webp",
};

/** The square badge of an event. It wiggles when the card it sits in is hovered (the parent has `group`). */
export function KindTile({ kind, muted = false }: { kind: HajatKind; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-[20px] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105 ${
        muted ? "bg-[#EFE6DE]" : "bg-gradient-to-br from-[#FFD8C7] to-[#FFEFE4]"
      }`}
    >
      {/* Static files in /public, 256 px, so the image optimizer adds nothing. A cancelled event goes grey. */}
      <Image
        src={ART[kind]}
        alt=""
        width={256}
        height={256}
        unoptimized
        draggable={false}
        className={`h-10 w-10 select-none ${muted ? "opacity-60 grayscale" : ""}`}
      />
    </span>
  );
}
