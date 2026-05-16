import { getEvents } from "@/lib/gate-server/events";
import { getVenues } from "@/lib/db/venues";
import { requireAuth } from "@/lib/auth/require-auth";
import GateForm from "@/components/gates/GateForm";
import GateHeader from "@/components/gates/GateHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewGatePage() {
  const { accessToken, traceId } = await requireAuth();

  const [eventsResult, venues] = await Promise.all([
    getEvents(accessToken, traceId),
    getVenues(),
  ]);

  const events = eventsResult.ok ? eventsResult.events : [];

  return (
    <div className="flex flex-col">
      <GateHeader />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Gate Details</CardTitle>
            <CardDescription>
              Configure the location and initial assignment for your new gate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GateForm events={events} venues={venues} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}