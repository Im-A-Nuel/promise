import type { Metadata } from "next";
import { EventsList } from "@/components/app/events-view";
import { Shell } from "@/components/app/shell";
import { Page } from "@/components/app/states";
import { makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("events.title") };
}

export default function EventsPage() {
  return (
    <Shell>
      <Page>
        <EventsList />
      </Page>
    </Shell>
  );
}
