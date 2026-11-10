import { useId, type ReactNode } from "react";

export type PaoMood = "waiting" | "sealed" | "opened" | "repaid";

/** A four pointed sparkle centered on (x, y). */
function Sparkle({ x, y, size, delay = 0, fill = "#F2C441" }: { x: number; y: number; size: number; delay?: number; fill?: string }) {
  const r = size / 2;
  const c = r * 0.22;
  const d = `M${x} ${y - r} Q${x + c} ${y - c} ${x + r} ${y} Q${x + c} ${y + c} ${x} ${y + r} Q${x - c} ${y + c} ${x - r} ${y} Q${x - c} ${y - c} ${x} ${y - r}Z`;
  return <path d={d} fill={fill} className="sparkle" style={{ animationDelay: `${delay}s` }} />;
}

interface PaoProps {
  mood: PaoMood;
  /** Accessible description, already translated. Leave empty for a purely decorative Pao. */
  label?: string;
  className?: string;
  animated?: boolean;
}

/**
 * Pao, the envelope character. Soft 3D comes from gradients and a gloss, not from any image.
 * The gold seal is its button nose. Mood follows the state of the card.
 */
export function Pao({ mood, label, className, animated = true }: PaoProps) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const open = mood === "waiting" || mood === "opened";
  const closedEyes = mood === "sealed" || mood === "repaid";

  const eye = (cx: number): ReactNode =>
    closedEyes ? (
      <path d={`M${cx - 11} 164 Q${cx} 148 ${cx + 11} 164`} fill="none" stroke="#2A1A12" strokeWidth="5.5" strokeLinecap="round" />
    ) : (
      <g>
        <ellipse cx={cx} cy={160} rx={9.5} ry={12.5} fill="#2A1A12" />
        <circle cx={cx + (mood === "waiting" ? 3.5 : 3)} cy={mood === "waiting" ? 153.5 : 155} r={3.6} fill="#fff" />
        <circle cx={cx - 3.5} cy={166} r={1.7} fill="#fff" opacity="0.85" />
      </g>
    );

  let mouth: ReactNode;
  if (mood === "waiting") {
    mouth = <ellipse cx="120" cy="184" rx="5.5" ry="6.5" fill="#2A1A12" />;
  } else if (mood === "opened") {
    mouth = (
      <g>
        <path d="M103 176 Q120 200 137 176 Q120 181 103 176Z" fill="#2A1A12" />
        <path d="M112 186 Q120 193 128 186 Q120 183 112 186Z" fill="#F77C8E" />
      </g>
    );
  } else {
    mouth = <path d="M107 180 Q120 192 133 180" fill="none" stroke="#2A1A12" strokeWidth="5" strokeLinecap="round" />;
  }

  const body = (
    <g className={animated ? "pao-float" : undefined}>
      {/* back flap, only when the envelope is open */}
      {open && (
        <g>
          <path d="M56 100 L120 34 L184 100 Z" fill={`url(#${id("flapBack")})`} stroke={`url(#${id("flapBack")})`} strokeWidth="14" strokeLinejoin="round" />
          <rect x="62" y="80" width="116" height="44" rx="12" fill={`url(#${id("paper")})`} />
        </g>
      )}

      {/* little arms */}
      <ellipse cx="32" cy="164" rx="13" ry="11" fill={`url(#${id("body")})`} />
      <ellipse cx="208" cy="164" rx="13" ry="11" fill={`url(#${id("body")})`} />

      {/* body */}
      <rect x="36" y="84" width="168" height="114" rx="36" fill={`url(#${id("body")})`} />

      {/* the pocket lip of the envelope, a soft curve */}
      {open && <path d="M46 110 Q120 156 194 110" fill="none" stroke="#8E1717" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />}

      {/* closed flap */}
      {!open && (
        <path d="M44 106 Q44 86 66 88 L174 88 Q196 86 196 106 Q196 112 190 116 L126 152 Q120 155 114 152 L50 116 Q44 112 44 106Z" fill={`url(#${id("flap")})`} />
      )}

      {/* gloss */}
      <ellipse cx="82" cy="104" rx="36" ry="11" transform="rotate(-16 82 104)" fill="#fff" opacity="0.28" />
      <path d="M52 134 Q47 118 56 104" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />

      {/* seal, the button nose */}
      {!open && (
        <g>
          <circle cx="120" cy="146" r="15" fill={`url(#${id("seal")})`} />
          <circle cx="120" cy="146" r="9.5" fill="none" stroke="#B78416" strokeOpacity="0.7" strokeWidth="2" />
          <ellipse cx="115" cy="140" rx="4.5" ry="2.6" fill="#fff" opacity="0.55" />
        </g>
      )}

      {/* face */}
      <g className={animated ? "pao-blink" : undefined}>
        {eye(90)}
        {eye(150)}
      </g>
      {mouth}
      <ellipse cx="66" cy="178" rx="13" ry="8" fill={`url(#${id("blush")})`} />
      <ellipse cx="174" cy="178" rx="13" ry="8" fill={`url(#${id("blush")})`} />

      {/* coin popping out */}
      {mood === "opened" && (
        <g>
          <circle cx="120" cy="62" r="22" fill={`url(#${id("seal")})`} />
          <circle cx="120" cy="62" r="15" fill="none" stroke="#B78416" strokeOpacity="0.65" strokeWidth="2.4" />
          <ellipse cx="112" cy="53" rx="6" ry="3.4" fill="#fff" opacity="0.6" />
        </g>
      )}

      {/* green check badge */}
      {mood === "repaid" && (
        <g>
          <circle cx="196" cy="86" r="23" fill="#2F6B3F" stroke="#fff" strokeWidth="5" />
          <path d="M185 86 l8 8 l14 -16" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 240 226" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} className={className}>
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9594E" />
          <stop offset="0.55" stopColor="#C42A24" />
          <stop offset="1" stopColor="#8E1717" />
        </linearGradient>
        <linearGradient id={id("flap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D8453B" />
          <stop offset="1" stopColor="#A42020" />
        </linearGradient>
        <linearGradient id={id("flapBack")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B32822" />
          <stop offset="1" stopColor="#7A1414" />
        </linearGradient>
        <linearGradient id={id("paper")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3E4" />
          <stop offset="1" stopColor="#F7D3BC" />
        </linearGradient>
        <radialGradient id={id("seal")} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#FFF0A8" />
          <stop offset="0.55" stopColor="#E7B22A" />
          <stop offset="1" stopColor="#B88518" />
        </radialGradient>
        <radialGradient id={id("blush")}>
          <stop offset="0" stopColor="#FF8DA1" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FF8DA1" stopOpacity="0" />
        </radialGradient>
        <filter id={id("shadow")} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse cx="120" cy="212" rx="80" ry="10" fill="#7A1414" opacity="0.2" filter={`url(#${id("shadow")})`} />
      {body}

      {mood === "opened" && (
        <g>
          <Sparkle x={52} y={52} size={22} />
          <Sparkle x={196} y={44} size={16} delay={0.8} />
          <Sparkle x={214} y={112} size={12} delay={1.6} fill="#fff" />
        </g>
      )}
      {mood === "repaid" && (
        <g>
          <Sparkle x={36} y={70} size={20} delay={0.4} />
          <Sparkle x={222} y={140} size={14} delay={1.2} />
          <Sparkle x={26} y={128} size={12} delay={2} fill="#fff" />
        </g>
      )}
      {mood === "sealed" && (
        <g>
          <Sparkle x={34} y={74} size={14} delay={0.6} />
          <Sparkle x={214} y={72} size={18} delay={1.4} />
        </g>
      )}
      {mood === "waiting" && <Sparkle x={206} y={64} size={14} delay={0.9} fill="#fff" />}
    </svg>
  );
}
