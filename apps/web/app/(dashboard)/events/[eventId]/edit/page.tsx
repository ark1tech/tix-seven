import type { Metadata } from "next";
import { getEventDetail } from "@/lib/gate-server/events";

export const metadata: Metadata = {
  title: "Edit",
};
import { getVenues } from "@/lib/db/venues";
import { requireAuth } from "@/lib/auth/require-auth";
import EventForm from "@/components/events/EventForm";
import { EventPageCancelAction } from "@/components/events/EventPageCancelAction";
import { notFound } from "next/navigation";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const { accessToken, traceId } = await requireAuth();

  const [detailResult, venues] = await Promise.all([
    getEventDetail(accessToken, eventId, traceId),
    getVenues(),
  ]);

  if (!detailResult.ok) notFound();

  const event = detailResult.event;
  const isMutable = event.status === "SCHEDULED" || event.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <EventPageCancelAction
        eventId={eventId}
        eventName={event.name}
        isMutable={isMutable}
      />

      <EventForm event={event} venues={venues} />
    </div>
  );
}
