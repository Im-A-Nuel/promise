import type { HajatKind } from "@/lib/near/types";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** One glyph per kind of event, each one drawn for what the event is. */
function Glyph({ kind }: { kind: HajatKind }) {
  switch (kind) {
    case "Wedding":
      // two rings and a small stone
      return (
        <g {...stroke}>
          <circle cx="9" cy="15" r="5" />
          <circle cx="15.5" cy="15" r="5" />
          <path d="M10.5 5.2 12 3.5l1.5 1.7L12 7z" />
        </g>
      );
    case "Khitan":
      // a garland of pennants
      return (
        <g {...stroke}>
          <path d="M3 6c4 4 14 4 18 0" />
          <path d="M6.6 9.4 8 14l2-3.6M11.2 11 12 16.5l1.3-5.3M15.6 10.6 17 14l1.6-4" />
        </g>
      );
    case "Birth":
      // a crescent moon over a small star
      return (
        <g {...stroke}>
          <path d="M17.5 4.5a8 8 0 1 0 2 11.5 6.4 6.4 0 0 1-2-11.5z" />
          <circle cx="16" cy="16.5" r="1.1" />
        </g>
      );
    case "Syukuran":
      // a house with a heart
      return (
        <g {...stroke}>
          <path d="M4 11.2 12 4l8 7.2V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path d="M12 16.8s-3-1.8-3-3.8a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2-3 3.8-3 3.8z" />
        </g>
      );
    case "Duka":
      // a candle
      return (
        <g {...stroke}>
          <rect x="9" y="11" width="6" height="9" rx="1.6" />
          <path d="M12 3.2c1.7 1.6 2.2 3 0 5-2.2-2-1.7-3.4 0-5z" />
        </g>
      );
    default:
      // a wrapped gift
      return (
        <g {...stroke}>
          <rect x="4" y="9" width="16" height="11" rx="2" />
          <path d="M4 13h16M12 9v11M12 9c-1.5-4-5-3.5-5-1.5S10 9 12 9zM12 9c1.5-4 5-3.5 5-1.5S14 9 12 9z" />
        </g>
      );
  }
}

/** The square badge of an event. It wiggles when the card it sits in is hovered (the parent has `group`). */
export function KindTile({ kind, muted = false }: { kind: HajatKind; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-[20px] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105 ${
        muted ? "bg-[#EFE6DE] text-ink-soft" : "bg-gradient-to-br from-[#FFD8C7] to-[#FFEFE4] text-red-dark"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <Glyph kind={kind} />
      </svg>
    </span>
  );
}
