import { getEventDetail } from "@/lib/gate-server/events";
import { getVenues } from "@/lib/db/venues";
import { requireAuth } from "@/lib/auth/require-auth";
import EventForm from "@/components/events/EventForm";
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

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <EventForm event={detailResult.event} venues={venues} />
    </div>
  );
}