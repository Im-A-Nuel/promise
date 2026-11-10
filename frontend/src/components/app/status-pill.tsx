"use client";

import { useHealth } from "@/lib/use-health";
import { useI18n } from "@/lib/i18n/client";

/** "Connected" pill. Tells the truth about testnet: checking, connected, slow or not deployed. */
export function StatusPill({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { data, isPending, isError } = useHealth();

  let label = t("status.connected");
  let dot = "bg-[#2fa05a]";
  if (isPending) {
    label = t("status.checking");
    dot = "bg-gold animate-pulse";
  } else if (isError) {
    label = t("status.unreachable");
    dot = "bg-[#d97706]";
  } else if (data && !data.deployed) {
    label = t("status.not_deployed");
    dot = "bg-[#d97706]";
  }

  return (
    <span role="status" className={`glass inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-extrabold text-ink ${className}`}>
      {label}
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${dot}`} />
    </span>
  );
}
