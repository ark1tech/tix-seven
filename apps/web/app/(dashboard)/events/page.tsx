import Link from "next/link";
import { getEvents } from "@/lib/db/events";
import { buttonVariants } from "@/components/ui/button";
import EventCard from "@/components/events/EventCard";

export default async function EventsPage() {
  // TODO: add error boundary / loading state
  const events = await getEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link href="/events/new" className={buttonVariants()}>New Event</Link>
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No events yet. Create your first event.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
