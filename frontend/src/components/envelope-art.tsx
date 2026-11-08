import type { ReactNode } from "react";

export type EnvelopeState = "invited" | "sealed" | "opened" | "repaid";

// Colors are the card palette from docs/CONTRACTS.md section 7. They are literals on purpose:
// the contract draws the same card, and an SVG shown through <img> cannot read CSS variables.
const PAPER = "#FBF7F0";
const INK = "#3A2A1A";
const INK_SOFT = "#6B5A48";
const RED = "#9B1C1C";
const RED_DARK = "#7A1414";
const GOLD = "#C9A227";
const GREEN = "#2F6B3F";
const LINE = "#E6DCCB";

interface EnvelopeArtProps {
  state: EnvelopeState;
  guest: string;
  hajat: string;
  tokenNo: number;
  /** Shown from Opened on, already formatted, for example "5.00". */
  amount?: string;
  /** Stamp text, already translated. */
  stamp: string;
  /** Accessible description, already translated. */
  label: string;
  id: string;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * A drawing of the invitation card in one state. It is an illustration used on the story
 * page. In the app, the card shown to users is the `media` field returned by the contract.
 */
export function EnvelopeArt({ state, guest, hajat, tokenNo, amount, stamp, label, id }: EnvelopeArtProps) {
  const open = state === "invited" || state === "opened";
  const stampColor = state === "repaid" ? GREEN : RED;
  const titleId = `${id}-title`;

  let flap: ReactNode;
  let centerpiece: ReactNode = null;

  if (open) {
    flap = (
      <>
        <polygon points="70,96 290,96 180,152" fill="#5E1010" />
        {state === "opened" && (
          <g>
            <circle cx="180" cy="114" r="23" fill={GOLD} />
            <circle cx="180" cy="114" r="18" fill="none" stroke={RED_DARK} strokeWidth="1" opacity="0.5" />
            <text x="180" y="119" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>
              {amount ?? ""}
            </text>
          </g>
        )}
      </>
    );
  } else {
    flap = <polygon points="70,96 290,96 180,160" fill={RED_DARK} />;
    centerpiece =
      state === "sealed" ? (
        <g>
          <circle cx="180" cy="150" r="16" fill={GOLD} />
          <circle cx="180" cy="150" r="10.5" fill="none" stroke={RED_DARK} strokeWidth="1.5" />
        </g>
      ) : (
        <g>
          <circle cx="180" cy="148" r="18" fill={GREEN} />
          <path d="M171 148 l7 7 l13 -14" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
  }

  return (
    <svg viewBox="0 0 360 220" role="img" aria-labelledby={titleId} className="block h-auto w-full">
      <title id={titleId}>{label}</title>
      <rect x="0.5" y="0.5" width="359" height="219" rx="16" fill={PAPER} stroke={LINE} />

      <text x="24" y="38" fontSize="18" fontWeight="600" fill={INK} fontFamily="Georgia, 'Times New Roman', serif">
        {truncate(guest, 16)}
      </text>
      <text x="24" y="56" fontSize="11" fill={INK_SOFT}>
        {truncate(hajat, 28)}
      </text>
      <text x="336" y="38" textAnchor="end" fontSize="12" fill={INK_SOFT}>
        #{tokenNo}
      </text>

      {/* Postmark style stamp: a rectangle on purpose, not a pill. */}
      <rect x="248" y="46" width="88" height="20" rx="3" fill="none" stroke={stampColor} strokeWidth="1.5" />
      <text x="292" y="60" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="0.6" fill={stampColor}>
        {stamp.toUpperCase()}
      </text>

      {open && <polygon points="70,96 290,96 180,48" fill={RED_DARK} />}
      <rect x="70" y="96" width="220" height="96" rx="6" fill={RED} />
      {open && flap}
      <polygon points="70,96 180,152 70,192" fill="#8A1919" />
      <polygon points="290,96 180,152 290,192" fill="#8A1919" />
      <polygon points="70,192 180,138 290,192" fill="#A62323" />
      {!open && flap}
      {centerpiece}

      {(state === "opened" || state === "repaid") && amount && (
        <text x="180" y="213" textAnchor="middle" fontSize="12" fill={INK_SOFT}>
          {amount} tUSDC
        </text>
      )}
    </svg>
  );
}
