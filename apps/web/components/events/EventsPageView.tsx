"use client";

import { useState } from "react";
import type { EventSummary } from "@tix-seven/types";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import EventCard from "@/components/events/EventCard";
import CreateEventCard from "@/components/events/CreateEventCard";
import { AddEventButton } from "@/components/events/AddEventButton";
import {
  matchesRegistrySearch,
  RegistryTableSearch,
} from "@/components/events/RegistryTableSearch";

function eventSearchFields(event: EventSummary): readonly string[] {
  return [event.name, event.venue_name, event.event_id];
}

export function EventsPageView({ events }: { events: EventSummary[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim() !== "";

  const filteredEvents = events.filter((event) =>
    matchesRegistrySearch(eventSearchFields(event), searchQuery),
  );

  return (
    <DashboardPageShell
      contentClassName="pt-6"
      header={
        <div className="flex items-center justify-between gap-4 border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <div className="flex items-center gap-2 shrink-0">
            <RegistryTableSearch
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search events"
            />
            <AddEventButton />
          </div>
        </div>
      }>
      {filteredEvents.length === 0 && isSearching ? (
        <p className="text-sm text-muted-foreground">
          No events found matching your search.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
          {filteredEvents.map((event) => (
            <EventCard key={event.event_id} event={event} />
          ))}
          {!isSearching ? <CreateEventCard /> : null}
        </div>
      )}
    </DashboardPageShell>
  );
}
