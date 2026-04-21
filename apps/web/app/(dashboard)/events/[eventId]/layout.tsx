import { getEvent } from "@/lib/db/events";
import EventHeader from "@/components/events/EventHeader";
import { notFound } from "next/navigation";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <EventHeader event={event} />
      {children}
    </div>
  );
}
