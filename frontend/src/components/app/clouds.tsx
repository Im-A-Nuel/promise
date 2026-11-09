/** Soft layered clouds along the bottom of a stage. Pure decoration, hidden from screen readers. */
export function Clouds({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 500 150" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="cloud-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFF3EA" />
        </linearGradient>
        <linearGradient id="cloud-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFE6D8" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* back layer, higher and a little pink */}
      <path
        d="M-10 150 V84 Q10 56 48 66 Q66 34 104 48 Q132 18 170 42 Q206 26 232 56 Q266 38 296 62 Q338 36 376 64 Q420 46 446 78 Q480 64 510 90 V150Z"
        fill="url(#cloud-back)"
      />
      {/* front layer */}
      <path
        d="M-10 150 V104 Q8 78 44 88 Q62 60 98 74 Q122 50 156 68 Q184 52 212 80 Q240 62 270 84 Q306 62 338 86 Q374 66 404 92 Q440 76 466 100 Q492 92 510 108 V150Z"
        fill="url(#cloud-front)"
      />
    </svg>
  );
}
