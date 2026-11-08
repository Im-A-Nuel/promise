"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
}
