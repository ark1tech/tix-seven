import Link from "next/link";
import { getEvent } from "@/lib/db/events";
import { getTickets } from "@/lib/db/tickets";
import { getEntryLogs } from "@/lib/db/entry-logs";
import { buttonVariants } from "@/components/ui/button";
import EventStats from "@/components/events/EventStats";
import TicketTable from "@/components/tickets/TicketTable";
import IssueTicketDialog from "@/components/tickets/IssueTicketDialog";
import type { EventStats as EventStatsType } from "@/types";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, tickets, logs] = await Promise.all([
    getEvent(eventId),
    getTickets(eventId),
    getEntryLogs(eventId),
  ]);

  const stats: EventStatsType = {
    sold: tickets.length,
    scanned: logs.filter((l) => l.result === "grant").length,
    denied: logs.filter((l) => l.result === "deny").length,
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(event.date).toLocaleDateString()} · {event.venue}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/edit`} className={buttonVariants({ variant: "outline" })}>Edit</Link>
          <Link href={`/events/${eventId}/entry-log`} className={buttonVariants({ variant: "outline" })}>Live Entry Log</Link>
        </div>
      </div>

      <EventStats stats={stats} capacity={event.capacity} />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Ticket Registry</h2>
          <IssueTicketDialog eventId={eventId} />
        </div>
        <TicketTable tickets={tickets} />
      </div>
    </div>
  );
}
