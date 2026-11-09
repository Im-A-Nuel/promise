import type { ReactNode } from "react";

/** A template remounts on every navigation, so each page eases in instead of snapping. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
