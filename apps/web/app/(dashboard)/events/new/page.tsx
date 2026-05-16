import { getVenues } from "@/lib/db/venues";
import EventForm from "@/components/events/EventForm";

export default async function NewEventPage() {
  const venues = await getVenues();

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Create Event</h1>
      <EventForm venues={venues} />
    </div>
  );
}