import { getEvents } from "@/lib/gate-server/events";
import { requireAuth } from "@/lib/auth/require-auth";
import EventCard from "@/components/events/EventCard";
import CreateEventCard from "@/components/events/CreateEventCard";

export default async function EventsPage() {
  const { accessToken, traceId } = await requireAuth();
  const result = await getEvents(accessToken, traceId);
  const events = result.ok ? result.events : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-5 border-b">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      </div>
      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {events.map((event) => (
          <EventCard key={event.event_id} event={event} />
        ))}
        <CreateEventCard />
      </div>
    </div>
  );
}