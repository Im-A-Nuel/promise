"use client";

import { useMemo } from "react";
import { DemoSigner, type AppSigner } from "@/lib/near/signer";
import { usePersona } from "@/lib/persona";

/**
 * The signer for whoever is signed in, or null. Today that is the chosen demo persona. When a real wallet
 * is added, this is the only place that changes: screens keep calling `signer.call`.
 */
export function useSigner(): AppSigner | null {
  const { persona } = usePersona();
  return useMemo(() => (persona ? new DemoSigner(persona) : null), [persona]);
}
