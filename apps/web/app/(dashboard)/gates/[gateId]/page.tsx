import { getGate } from "@/lib/db/gates";
import { getEvents } from "@/lib/db/events";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function GateDetailPage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  const [gate, events] = await Promise.all([
    getGate(gateId),
    getEvents()
  ]);

  const assignedEvent = events.find(e => e.event_id === gate.event_id);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hardware Status</CardTitle>
            <CardDescription>Current connectivity and operational state.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-3 w-3 rounded-full animate-pulse",
                gate.status === "ONLINE" ? "bg-emerald-500" : "bg-zinc-400"
              )} />
              <div>
                <p className="font-medium">{gate.status === "ONLINE" ? "Online" : "Offline"}</p>
                <p className="text-xs text-muted-foreground">
                  {gate.status === "ONLINE" ? "Gate is actively listening for scans." : "Gate is not currently accepting scans."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Assignment</CardTitle>
            <CardDescription>Event context for QR code validation.</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedEvent ? (
              <div>
                <p className="font-medium text-primary">{assignedEvent.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignedEvent.venue_name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unassigned</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
