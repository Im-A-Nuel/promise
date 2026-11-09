import { Shell } from "@/components/app/shell";
import { Empty, Page } from "@/components/app/states";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <Shell>
      <Page>
        <Empty title={t("notfound.title")} body={t("notfound.body")} href="/" cta={t("notfound.home")} />
      </Page>
    </Shell>
  );
}
