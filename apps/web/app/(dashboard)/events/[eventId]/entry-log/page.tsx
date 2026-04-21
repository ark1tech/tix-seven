import { getEntryLogs } from "@/lib/db/entry-logs";
import { isMockMode } from "@/lib/supabase/server";
import EntryLogFeed from "@/components/entry-log/EntryLogFeed";

export default async function EntryLogPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [initialLogs, mock] = await Promise.all([
    getEntryLogs(eventId),
    isMockMode(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <EntryLogFeed eventId={eventId} initialLogs={initialLogs} isMock={mock} />
    </div>
  );
}
