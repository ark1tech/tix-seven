import { getEvent } from "@/lib/db/events";
import { getTickets } from "@/lib/db/tickets";
import { getEntryLogs } from "@/lib/db/entry-logs";
import EventStats from "@/components/events/EventStats";
import TicketTable from "@/components/tickets/TicketTable";
import type { EventStats as EventStatsType } from "@tix-seven/types";

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

      <EventStats stats={stats} capacity={event.capacity} />

      <div className="flex flex-col gap-4">
        <TicketTable tickets={tickets} />
      </div>
    </div>
  );
}
