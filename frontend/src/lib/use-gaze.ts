"use client";

import { useEffect, type RefObject } from "react";

/**
 * Makes a mascot look at the pointer. One listener serves every mascot on the page: it measures where each
 * one sits, and writes how far to lean as two numbers between -1 and 1 into `--gx` and `--gy` on the svg.
 * CSS turns those into small movements, so React never re-renders while the pointer moves.
 */

const targets = new Set<SVGSVGElement>();
let pointer: { x: number; y: number } | null = null;
let frame = 0;
let attached = false;

/** Distance in px at which a mascot leans its full amount. Closer than this, it leans less. */
const REACH = 280;

function update(): void {
  frame = 0;
  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    let gx = 0;
    let gy = 0;
    if (pointer) {
      // aim from the height of the eyes, which sit about two thirds down the figure
      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height * 0.68);
      const distance = Math.hypot(dx, dy) || 1;
      const lean = Math.min(distance / REACH, 1);
      gx = (dx / distance) * lean;
      gy = (dy / distance) * lean;
    }
    el.style.setProperty("--gx", gx.toFixed(3));
    el.style.setProperty("--gy", gy.toFixed(3));
  }
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(update);
}

function onMove(event: PointerEvent): void {
  pointer = { x: event.clientX, y: event.clientY };
  schedule();
}

function onLeave(): void {
  pointer = null;
  schedule();
}

function attach(): void {
  if (attached) return;
  attached = true;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
}

function detach(): void {
  if (!attached) return;
  attached = false;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerdown", onMove);
  window.removeEventListener("scroll", schedule);
  document.documentElement.removeEventListener("pointerleave", onLeave);
}

/** Registers the svg as a mascot that follows the pointer. Does nothing when the person asked for less motion. */
export function useGaze(ref: RefObject<SVGSVGElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    targets.add(el);
    attach();
    schedule();
    return () => {
      targets.delete(el);
      if (targets.size === 0) detach();
    };
  }, [ref]);
}
