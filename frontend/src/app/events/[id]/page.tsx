import { EventDetail } from "@/components/app/events-view";
import { Shell } from "@/components/app/shell";
import { Page } from "@/components/app/states";

export default function EventPage() {
  return (
    <Shell>
      <Page>
        <EventDetail />
      </Page>
    </Shell>
  );
}
