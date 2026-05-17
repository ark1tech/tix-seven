import type { Metadata } from "next";
import { getEntryLogs } from "@/lib/gate-server/entry-logs";

export const metadata: Metadata = {
  title: "Entry Log",
};
import { requireAuth } from "@/lib/auth/require-auth";
import EntryLogFeed from "@/components/entry-log/EntryLogFeed";

export default async function EntryLogPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const { accessToken, traceId } = await requireAuth();

  const logsResult = await getEntryLogs(accessToken, eventId, {}, traceId);

  const logs = logsResult.ok ? logsResult.data.logs : [];

  return (
    <div className="flex flex-col gap-4">
      <EntryLogFeed eventId={eventId} initialLogs={logs} />
    </div>
  );
}
