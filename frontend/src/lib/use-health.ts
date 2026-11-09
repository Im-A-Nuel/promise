"use client";

import { useQuery } from "@tanstack/react-query";
import { healthSchema, type Health } from "@/lib/near/types";

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return healthSchema.parse(await res.json());
}

/** Whether testnet answers and whether the Promise contracts exist there. Shared by every screen. */
export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: fetchHealth, staleTime: 10_000 });
}
