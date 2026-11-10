"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/lib/i18n/client";
import { useOnline } from "@/lib/use-online";

/** Slides in under the header when the device loses its network, and leaves when it is back. */
export function NetworkBanner() {
  const { t } = useI18n();
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="glass fixed inset-x-3 top-[4.25rem] z-40 mx-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold text-red-dark"
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-bright" />
          {t("net.offline")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
