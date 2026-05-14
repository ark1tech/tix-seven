import { getEntryLogs } from "@/lib/gate-server/entry-logs";
import EntryLogFeed from "@/components/entry-log/EntryLogFeed";

export default async function EntryLogPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const initialLogs = await getEntryLogs(eventId);

  return (
    <div className="flex flex-col gap-4">
      <EntryLogFeed eventId={eventId} initialLogs={initialLogs} />
    </div>
  );
}
