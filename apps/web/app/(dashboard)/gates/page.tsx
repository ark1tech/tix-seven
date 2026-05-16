import { getGates } from "@/lib/db/gates";
import { getEvents } from "@/lib/gate-server/events";
import { requireAuth } from "@/lib/auth/require-auth";
import GateTable from "@/components/gates/GateTable";
import GateHeader from "@/components/gates/GateHeader";
import type { GateWithAssignment } from "@/components/gates/GateTable";

export default async function GatesPage() {
  const { accessToken, traceId } = await requireAuth();

  const [gates, eventsResult] = await Promise.all([
    getGates(),
    getEvents(accessToken, traceId),
  ]);

  const events = eventsResult.ok ? eventsResult.events : [];

  const gatesWithAssignment: GateWithAssignment[] = gates.map((gate) => ({
    ...gate,
    currentEventId: gate.event_id,
  }));

  return (
    <div className="flex flex-col">
      <GateHeader />
      <div className="w-full">
        <GateTable gates={gatesWithAssignment} events={events} />
      </div>
    </div>
  );
}