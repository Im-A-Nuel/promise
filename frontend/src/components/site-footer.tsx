import type { Translate } from "@/lib/i18n";

export function SiteFooter({ t }: { t: Translate }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
        <p>{t("footer.line")}</p>
        <p>{t("footer.license")}</p>
      </div>
    </footer>
  );
}
