import { getEventDetail } from "@/lib/gate-server/events";
import { requireAuth } from "@/lib/auth/require-auth";
import EventHeader from "@/components/events/EventHeader";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/utils";

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
    <div className="flex flex-col">
      <EventHeader event={result.event} />
      {children}
    </div>
  );
}