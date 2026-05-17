import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "New Event",
};
import { ChevronRight } from "lucide-react";
import { getVenues } from "@/lib/db/venues";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import EventForm from "@/components/events/EventForm";

export default async function NewEventPage() {
  const venues = await getVenues();

  return (
    <DashboardPageShell
      contentClassName="pt-6"
      header={
        <div className="border-b pb-5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link
              href="/events"
              className="hover:text-foreground transition-colors duration-150">
              Events
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Create Event</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create Event
          </h1>
        </div>
      }>
      <div className="flex max-w-lg flex-col gap-6">
        <EventForm venues={venues} />
      </div>
    </DashboardPageShell>
  );
}
