import { getEvent } from "@/lib/db/events";
import { getEntryLogs } from "@/lib/db/entry-logs";
import EntryLogFeed from "@/components/entry-log/EntryLogFeed";

export default async function EntryLogPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, initialLogs] = await Promise.all([
    getEvent(eventId),
    getEntryLogs(eventId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Live Entry Log</h1>
        <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
      </div>
      <EntryLogFeed eventId={eventId} initialLogs={initialLogs} />
    </div>
  );
}
