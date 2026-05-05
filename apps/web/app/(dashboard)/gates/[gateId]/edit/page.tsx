import { getGate } from "@/lib/db/gates";
import { getEvents } from "@/lib/db/events";
import { getVenues } from "@/lib/db/venues";
import GateForm from "@/components/gates/GateForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditGatePage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  const [gate, events, venues] = await Promise.all([
    getGate(gateId),
    getEvents(),
    getVenues()
  ]);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Gate</CardTitle>
          <CardDescription>
            Update the location and hardware configuration for this gate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GateForm events={events} venues={venues} gate={gate} />
        </CardContent>
      </Card>
    </div>
  );
}
