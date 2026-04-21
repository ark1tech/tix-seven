import { getEvent } from "@/lib/db/events";
import EventForm from "@/components/events/EventForm";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <EventForm event={event} />
    </div>
  );
}
