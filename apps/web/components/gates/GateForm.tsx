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
import type { Event, Gate } from "@tix-seven/types";
import type { Venue } from "@/lib/db/venues";

interface Props {
  events: Event[];
  venues: Venue[];
  gate?: Gate;
}

export default function GateForm({ events, venues, gate }: Props) {
  const router = useRouter();
  const isEditing = !!gate;
  const [location, setLocation] = useState(gate?.location ?? "");
  const [venueId, setVenueId] = useState<string>(gate?.venue_id ?? venues[0]?.venue_id ?? "");
  const [eventId, setEventId] = useState<string>(gate?.event_id ?? "unassigned");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const body = await res.json();
      const errMsg = typeof body.error === "string" ? body.error : (body.error?.formErrors?.[0] || body.error?.message || "Failed to register gate");
      setError(errMsg);
      setLoading(false);
      return;
    }

    const saved = await res.json();
    startTransition(() => {
      if (isEditing) {
        router.push(`/gates/${gate.gate_id}`);
      } else {
        router.push("/gates");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gate-venue">Venue</Label>
        <Select value={venueId} onValueChange={(v) => v && setVenueId(v)} required>
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
      </div>

      <div className="pt-4 border-t mt-2">
        <h3 className="text-sm font-medium mb-4">Initial Assignment</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-event">Assign to Event</Label>
          <Select value={eventId} onValueChange={(v) => setEventId(v ?? "unassigned")}>
            <SelectTrigger id="assign-event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.event_id} value={event.event_id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            You can also assign events later from the gates list.
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
