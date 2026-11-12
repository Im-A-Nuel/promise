import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetail } from "@/components/app/events-view";
import { Page } from "@/components/app/states";
import { getT } from "@/lib/i18n/server";
import { getHajat } from "@/lib/near/contract";

// The tab and a shared link name the event, not just the app. If the chain does not answer, the generic title stays.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const n = Number(id);
  if (Number.isInteger(n) && n > 0) {
    try {
      const hajat = await getHajat(n);
      if (hajat) return { title: hajat.title };
    } catch {
      // fall through to the generic title
    }
  }
  const { t } = await getT();
  return { title: t("events.title") };
}

export default function EventPage() {
  return (
    <>
      <Page>
        <Suspense>
          <EventDetail />
        </Suspense>
      </Page>
    </>
  );
}
