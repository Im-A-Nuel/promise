import type { CSSProperties } from "react";

/**
 * A headline whose words rise into place one after another, each from behind its own line edge.
 * It is plain CSS, so it runs before any script loads. Words stay real text, in order, for readers and search.
 */
export function RiseWords({ text, start = 120, step = 75 }: { text: string; start?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((word, i, all) => (
        <span key={`${word}-${i}`}>
          <span className="word">
            <span className="word-in" style={{ "--wd": `${start + i * step}ms` } as CSSProperties}>
              {word}
            </span>
          </span>
          {i < all.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
