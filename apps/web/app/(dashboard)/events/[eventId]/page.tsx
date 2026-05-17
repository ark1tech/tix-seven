import { getEventDetail } from "@/lib/gate-server/events";
import { getEntryLogs } from "@/lib/gate-server/entry-logs";
import { getTickets } from "@/lib/gate-server/tickets";
import { requireAuth } from "@/lib/auth/require-auth";
import { EventRegistrySection } from "@/components/events/EventRegistrySection";
import { notFound } from "next/navigation";
import type { LogSummary } from "@tix-seven/types";
import { EventOverviewCard } from "@/components/events/EventOverviewCard";

const EMPTY_LOG_SUMMARY: LogSummary = {
  total: 0,
  granted: 0,
  denied: 0,
  timeout_or_error: 0,
  denial_breakdown: [],
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const { accessToken, traceId } = await requireAuth();

  const [detailResult, logsResult, ticketsResult] = await Promise.all([
    getEventDetail(accessToken, eventId, traceId),
    getEntryLogs(accessToken, eventId, {}, traceId),
    getTickets(accessToken, eventId, {}, traceId),
  ]);

  if (!detailResult.ok) notFound();

  const event = detailResult.event;
  const logSummary = logsResult.ok
    ? logsResult.data.summary
    : EMPTY_LOG_SUMMARY;
  const tickets = ticketsResult.ok ? ticketsResult.data.tickets : [];

  const isMutable = event.status === "SCHEDULED" || event.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-8">
      <EventOverviewCard
        ticketSummary={event.ticket_summary}
        logSummary={logSummary}
        capacity={event.capacity}
      />

      <EventRegistrySection
        eventId={eventId}
        venueId={event.venue_id}
        isMutable={isMutable}
        initialTickets={tickets}
        initialGates={event.assigned_gates}
      />
    </div>
  );
}
