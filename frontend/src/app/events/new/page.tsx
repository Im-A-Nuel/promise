import type { Metadata } from "next";
import { NewEventForm } from "@/components/app/new-event-form";
import { Shell } from "@/components/app/shell";
import { Page, PageTitle } from "@/components/app/states";
import { makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("eventnew.title") };
}

export default async function NewEventPage() {
  const { t } = await getT();
  return (
    <Shell>
      <Page>
        <PageTitle title={t("eventnew.title")} lead={t("eventnew.lead")} />
        <NewEventForm />
      </Page>
    </Shell>
  );
}
