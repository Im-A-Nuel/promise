import Image from "next/image";

export type PaoMood = "waiting" | "sealed" | "opened" | "repaid" | "sleepy" | "oops";

// One 800 px square per pose. The envelope body has the same width and baseline in every file, so swapping a
// pose never makes the envelope jump. "repaid" is the sealed envelope with a check drawn over the seal.
const ART: Record<PaoMood, string> = {
  waiting: "/art/pao-open-empty.webp",
  sealed: "/art/pao-sealed.webp",
  opened: "/art/pao-open-coin.webp",
  repaid: "/art/pao-sealed.webp",
  sleepy: "/art/pao-sleepy.webp",
  oops: "/art/pao-oops.webp",
};

/** A four pointed star. Used for the few poses that celebrate. */
function Star({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`sparkle absolute ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <path d="M12 1.5 14.3 9.7 22.5 12 14.3 14.3 12 22.5 9.7 14.3 1.5 12 9.7 9.7Z" fill="#F2C441" />
    </svg>
  );
}

/** The green mark over the seal of a settled card. It sits where the seal is in `pao-sealed`. */
export function SealBadge({ kind }: { kind: "repaid" | "reply" }) {
  return (
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-[63.5%] grid h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#2F6B3F] text-white shadow-[0_6px_12px_-4px_rgba(20,60,30,0.6)] ring-[3px] ring-[#E9F3EA]"
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {kind === "repaid" ? <path d="m5 12.5 4.6 4.6L19 7.5" /> : <path d="M5 9h13m-4-4 4 4-4 4M19 15H6m4-4-4 4 4 4" />}
      </svg>
    </span>
  );
}

interface PaoProps {
  mood: PaoMood;
  /** Accessible description, already translated. Leave empty for a purely decorative Pao. */
  label?: string;
  className?: string;
  animated?: boolean;
  /** Set on the picture that is the first thing on screen, so it is fetched before the rest. */
  priority?: boolean;
}

/**
 * Pao, the envelope character, in the soft 3D clay artwork. The pose follows the state of the card.
 * The root takes the size and position classes, the picture inside floats gently.
 */
export function Pao({ mood, label, className, animated = true, priority = false }: PaoProps) {
  return (
    <div className={className} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      {/* The files are squares with empty room above the envelope. This box keeps the lower 78 percent, enough for
          the tallest pose (open with a coin), so a Pao in a row of text does not leave a gap above it. */}
      <div className={`relative aspect-[800/620] overflow-hidden ${animated ? "pao-float" : ""}`}>
        <div className="absolute inset-x-0 bottom-0 aspect-square">
          {/* The artwork is a static file in /public, already compressed, so the image optimizer adds nothing. */}
          <Image src={ART[mood]} alt="" width={800} height={800} unoptimized priority={priority} draggable={false} className="block h-auto w-full select-none" />
          {mood === "repaid" && <SealBadge kind="repaid" />}
          {mood === "opened" && (
            <>
              <Star className="left-[14%] top-[24%] h-[7%] w-[7%]" />
              <Star className="right-[16%] top-[27%] h-[5%] w-[5%]" delay={0.9} />
            </>
          )}
          {mood === "repaid" && (
            <>
              <Star className="left-[12%] top-[42%] h-[6%] w-[6%]" delay={0.4} />
              <Star className="right-[10%] top-[50%] h-[5%] w-[5%]" delay={1.3} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
