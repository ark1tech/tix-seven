import { getEvents } from "@/lib/db/events";
import EventCard from "@/components/events/EventCard";
import CreateEventCard from "@/components/events/CreateEventCard";

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-5 border-b">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      </div>
      
      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
        <CreateEventCard />
      </div>
    </div>
  );
}
