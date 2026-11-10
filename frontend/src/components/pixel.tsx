import type { Sprite } from "./pixel-sprites";

/** The colors a sprite may use. A character that is not here is a typo, and pixel.test.ts fails on it. */
export const PALETTE: Record<string, string> = {
  K: "#3A2A1A", // outline
  R: "#D8453B", // red
  D: "#9B1C1C", // dark red
  L: "#FF9C8A", // red highlight
  G: "#F2C441", // gold
  g: "#B8861A", // dark gold
  Y: "#FFF0A8", // pale gold
  W: "#FFFFFF",
  C: "#FFF1E3", // paper
  P: "#FFD8C7", // peach
  S: "#F7C9A4", // skin
  B: "#7A4A2A", // wood
  T: "#E9DCCB", // light wood and stone
  N: "#2F6B3F", // green
  n: "#8FD3A0", // light green
  E: "#6B5A48", // soft ink
  O: "#FF9A8B", // blush
  H: "#2A1A12", // black
  h: "#2A1A12", // hair, usually overridden
  r: "#D8453B", // shirt, usually overridden
};

interface PixelArtProps {
  sprite: Sprite;
  /** Screen pixels per sprite pixel. Whole numbers keep the edges sharp. */
  scale?: number;
  /** Replaces colors for this one drawing, for example `{ h: "#7A4A2A", r: "#2F6B3F" }`. */
  palette?: Record<string, string>;
  /** Read aloud. Leave it out when the drawing only decorates and a caption already says the same. */
  label?: string;
  className?: string;
}

/**
 * Draws a sprite as an svg. Runs of one color in a row become one rectangle, so a 16 by 16 sprite is a few
 * dozen nodes, and `crispEdges` keeps every pixel square at any size.
 */
export function PixelArt({ sprite, scale = 5, palette, label, className }: PixelArtProps) {
  const colors = { ...PALETTE, ...palette };
  const height = sprite.length;
  const width = sprite[0]?.length ?? 0;
  const rects: { x: number; y: number; w: number; fill: string }[] = [];

  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? ".";
      if (ch === ".") {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      rects.push({ x, y, w: end - x, fill: colors[ch] ?? "#FF00FF" });
      x = end;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </svg>
  );
}
