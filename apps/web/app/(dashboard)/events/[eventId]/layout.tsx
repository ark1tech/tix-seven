import type { Metadata } from "next";
import { getEventDetail } from "@/lib/gate-server/events";
import { requireAuth } from "@/lib/auth/require-auth";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import EventHeader from "@/components/events/EventHeader";
import { EventExportProvider } from "@/components/events/event-export-context";
import { EventHeaderActionsProvider } from "@/components/events/event-header-actions";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  if (!isUuid(eventId)) {
    return { title: "Event" };
  }

  const { accessToken, traceId } = await requireAuth();
  const result = await getEventDetail(accessToken, eventId, traceId);
  if (!result.ok) {
    return { title: "Event" };
  }

  return {
    title: {
      template: `%s · ${result.event.name}`,
      default: result.event.name,
    },
  };
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();

  const { accessToken, traceId } = await requireAuth();
  const result = await getEventDetail(accessToken, eventId, traceId);

  if (!result.ok) notFound();

  return (
    <EventHeaderActionsProvider>
      <EventExportProvider>
        <DashboardPageShell
          contentClassName="pt-8"
          header={<EventHeader event={result.event} />}>
          {children}
        </DashboardPageShell>
      </EventExportProvider>
    </EventHeaderActionsProvider>
  );
}
