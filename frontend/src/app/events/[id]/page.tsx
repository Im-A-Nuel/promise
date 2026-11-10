import { Suspense } from "react";
import { EventDetail } from "@/components/app/events-view";
import { Page } from "@/components/app/states";

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
