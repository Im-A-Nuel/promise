import { useId } from "react";
import { formatAmount } from "@/lib/near/format";

/**
 * The tUSDC coin. A gold rim, a lighter face with a hand-drawn dollar, and a gloss. It is drawn here
 * because a currency mark is part of the brand: the amount reads as money before the eye reaches the number.
 */
export function TusdcCoin({ className = "h-6 w-6" }: { className?: string }) {
  const uid = useId();
  const rim = `${uid}-rim`;
  const face = `${uid}-face`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={rim} x1="6" y1="3" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6D669" />
          <stop offset="1" stopColor="#B8861A" />
        </linearGradient>
        <linearGradient id={face} x1="9" y1="6" x2="24" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF2B8" />
          <stop offset="1" stopColor="#F2C441" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${rim})`} />
      <circle cx="16" cy="16" r="11.6" fill={`url(#${face})`} stroke="#A57A14" strokeOpacity=".35" strokeWidth="1" />
      <path
        d="M19.8 12.2c-.9-1.4-2.5-1.9-4-1.7-1.9.3-2.7 2-1.5 3.1 1.3 1.1 4.6 1 5.5 2.8.9 1.8-.6 3.5-2.9 3.7-1.7.2-3.3-.3-4.3-1.6M16 8.6v14.8"
        fill="none"
        stroke="#8A6410"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="10.6" cy="8.6" rx="4.2" ry="2" transform="rotate(-32 10.6 8.6)" fill="#fff" opacity=".5" />
    </svg>
  );
}

const SIZES = {
  sm: { coin: "h-5 w-5", text: "text-sm", gap: "gap-1.5" },
  md: { coin: "h-6 w-6", text: "text-base", gap: "gap-2" },
  lg: { coin: "h-8 w-8", text: "text-2xl", gap: "gap-2.5" },
} as const;

/** An amount of tUSDC: the coin, the figure, and the unit in small type. `units` is base units as a string. */
export function Amount({ units, size = "md", showUnit = true }: { units: string | bigint; size?: keyof typeof SIZES; showUnit?: boolean }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      <TusdcCoin className={s.coin} />
      <span className={`tabular font-display font-semibold leading-none ${s.text}`}>{formatAmount(units)}</span>
      {showUnit && <span className="text-xs font-extrabold text-ink-soft">tUSDC</span>}
    </span>
  );
}
