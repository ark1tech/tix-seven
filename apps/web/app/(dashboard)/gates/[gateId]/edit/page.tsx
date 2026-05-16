import { getGate } from "@/lib/db/gates";
import { getEvents } from "@/lib/gate-server/events";
import { getVenues } from "@/lib/db/venues";
import { requireAuth } from "@/lib/auth/require-auth";
import GateForm from "@/components/gates/GateForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

export default async function EditGatePage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  const { accessToken, traceId } = await requireAuth();

  const [gate, eventsResult, venues] = await Promise.all([
    getGate(gateId),
    getEvents(accessToken, traceId),
    getVenues(),
  ]);

  if (!gate) notFound();

  const events = eventsResult.ok ? eventsResult.events : [];

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Gate</CardTitle>
          <CardDescription>
            Update the location and assignment for this gate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GateForm
            events={events}
            venues={venues}
            gate={gate}
            currentEventId={gate.event_id ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}