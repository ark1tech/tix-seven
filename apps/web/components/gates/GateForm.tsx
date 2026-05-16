"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventSummary, Gate, Venue } from "@tix-seven/types";

interface Props {
  events: EventSummary[];
  venues: Venue[];
  gate?: Gate;
  // The current active assignment cannot be read off Gate directly — it lives
  // on GateAssignment. The page fetches it separately and passes it here.
  currentEventId?: string | null;
}

export default function GateForm({ events, venues, gate, currentEventId }: Props) {
  const router = useRouter();
  const isEditing = !!gate;

  const [location, setLocation] = useState(gate?.location ?? "");
  const [venueId, setVenueId] = useState<string>(gate?.venue_id ?? venues[0]?.venue_id ?? "");
  const [eventId, setEventId] = useState<string>(currentEventId ?? "unassigned");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show events that are assignable: SCHEDULED or ACTIVE.
  // CONCLUDED and CANCELLED events cannot receive new assignments.
  const assignableEvents = events.filter(
    (e) => e.status === "SCHEDULED" || e.status === "ACTIVE"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = isEditing ? `/api/gates/${gate.gate_id}` : "/api/gates";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location,
        venue_id: venueId,
        event_id: eventId === "unassigned" ? null : eventId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg =
        typeof body.error === "string"
          ? body.error
          : body.error?.formErrors?.[0] ?? body.error?.message ?? "Failed to save gate";
      setError(errMsg);
      setLoading(false);
      return;
    }

    startTransition(() => {
      router.push(isEditing ? `/gates/${gate.gate_id}` : "/gates");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gate-location">Location</Label>
        <Input
          id="gate-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Main Entrance"
          required
        />
      </div>

      {/* Venue */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gate-venue">Venue</Label>
        <Select
          value={venueId}
          onValueChange={(v) => v && setVenueId(v)}
          disabled={isEditing}
          required
        >
          <SelectTrigger id="gate-venue">
            <SelectValue placeholder="Select a venue" />
          </SelectTrigger>
          <SelectContent>
            {venues.map((venue) => (
              <SelectItem key={venue.venue_id} value={venue.venue_id}>
                {venue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEditing && (
          <p className="text-[11px] text-muted-foreground">
            Venue cannot be changed after a gate is registered.
          </p>
        )}
      </div>

      {/* Event assignment */}
      <div className="pt-4 border-t mt-2">
        <h3 className="text-sm font-medium mb-4">
          {isEditing ? "Event Assignment" : "Initial Assignment"}
        </h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-event">Assign to Event</Label>
          <Select value={eventId} onValueChange={(v) => setEventId(v ?? "unassigned")}>
            <SelectTrigger id="assign-event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignableEvents.map((event) => (
                <SelectItem key={event.event_id} value={event.event_id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Only scheduled or active events are shown. You can reassign from the gates list.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : isEditing ? "Save Changes" : "Register Gate"}
      </Button>
    </form>
  );
}