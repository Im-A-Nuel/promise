import type { Translate } from "@/lib/i18n";

export function SiteFooter({ t }: { t: Translate }) {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-28 pt-4 text-sm text-ink-soft sm:px-6 lg:flex-row lg:items-baseline lg:justify-between lg:pb-10">
        <p>{t("footer.line")}</p>
        <p>{t("footer.license")}</p>
      </div>
    </footer>
  );
}
