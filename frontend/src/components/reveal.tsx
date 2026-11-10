"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Eases a block into view when the reader scrolls to it: it fades in, rises and settles from a slightly
 * smaller size. The block is only hidden once the page is running and only if it starts below the fold, so
 * what is already on screen never flashes, and without scripts everything stays visible.
 * `delay` (seconds) staggers siblings. Does nothing under reduced motion.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.dataset.reveal = "armed";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ "--rd": `${Math.round(delay * 1000)}ms` } as CSSProperties}>
      {children}
    </div>
  );
}
