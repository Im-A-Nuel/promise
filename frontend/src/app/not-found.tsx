import { Empty, Page } from "@/components/app/states";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <>
      <Page>
        <Empty mood="oops" title={t("notfound.title")} body={t("notfound.body")} href="/" cta={t("notfound.home")} />
      </Page>
    </>
  );
}
