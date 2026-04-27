import { getEvent } from "@/lib/db/events";
import EventHeader from "@/components/events/EventHeader";
import { notFound } from "next/navigation";
import { getAssignedGatesAction } from "./mock-scan-action";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, gates] = await Promise.all([
    getEvent(eventId),
    getAssignedGatesAction(eventId)
  ]);

  if (!event) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <EventHeader event={event} gates={gates} />
      {children}
    </div>
  );
}
