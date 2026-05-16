import { getGate } from "@/lib/db/gates";
import { getEvents } from "@/lib/gate-server/events";
import { requireAuth } from "@/lib/auth/require-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/events/EventStatusBadge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function GateDetailPage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  const { accessToken, traceId } = await requireAuth();

  const [gate, eventsResult] = await Promise.all([
    getGate(gateId),
    getEvents(accessToken, traceId),
  ]);

  if (!gate) notFound();

  const events = eventsResult.ok ? eventsResult.events : [];
  const assignedEvent = gate.event_id
    ? events.find((e) => e.event_id === gate.event_id) ?? null
    : null;

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
              <div
                className={cn(
                  "h-3 w-3 rounded-full",
                  gate.status === "ONLINE" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                )}
              />
              <div>
                <p className="font-medium">
                  {gate.status === "ONLINE" ? "Online" : "Offline"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gate.status === "ONLINE"
                    ? "Gate is actively listening for scans."
                    : "Gate is not currently accepting scans."}
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/events/${assignedEvent.event_id}`}
                    className="font-medium text-primary hover:underline underline-offset-4"
                  >
                    {assignedEvent.name}
                  </Link>
                  <EventStatusBadge status={assignedEvent.status} />
                </div>
                <p className="text-xs text-muted-foreground">{assignedEvent.venue_name}</p>
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