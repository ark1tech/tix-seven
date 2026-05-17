import type { Metadata } from "next";
import { getEvents } from "@/lib/gate-server/events";

export const metadata: Metadata = {
  title: "Events",
};
import { requireAuth } from "@/lib/auth/require-auth";
import { EventsPageView } from "@/components/events/EventsPageView";

export default async function EventsPage() {
  const { accessToken, traceId } = await requireAuth();
  const result = await getEvents(accessToken, traceId);
  const events = result.ok ? result.events : [];

  return <EventsPageView events={events} />;
}
