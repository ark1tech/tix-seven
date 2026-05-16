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
import {
  datetimeLocalInputToPhtSqlTimestamp,
  eventTimestampToDatetimeLocalValue,
} from "@/lib/datetime-pht";
import type { EventSummary, Venue } from "@tix-seven/types";

interface Props {
  venues: Venue[];
  event?: EventSummary;
}

export default function EventForm({ venues, event }: Props) {
  const router = useRouter();
  const isEditing = !!event;

  const [name, setName] = useState(event?.name ?? "");
  const [startTime, setStartTime] = useState(
    event ? eventTimestampToDatetimeLocalValue(event.start_time) : "",
  );
  const [endTime, setEndTime] = useState(
    event ? eventTimestampToDatetimeLocalValue(event.end_time) : "",
  );
  const [venueId, setVenueId] = useState<string>(
    event?.venue_id ?? venues[0]?.venue_id ?? "",
  );
  const [capacity, setCapacity] = useState(event?.capacity?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name,
      start_time: datetimeLocalInputToPhtSqlTimestamp(startTime),
      end_time: datetimeLocalInputToPhtSqlTimestamp(endTime),
      venue_id: venueId,
      capacity: parseInt(capacity, 10),
    };

    const url = isEditing ? `/api/events/${event.event_id}` : "/api/events";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      const errMsg =
        typeof body.error === "string"
          ? body.error
          : body.error?.formErrors?.[0] ?? body.error?.message ?? "Something went wrong.";
      setError(errMsg);
      setLoading(false);
      return;
    }

    const saved = (await res.json()) as EventSummary;
    startTransition(() => {
      router.push(`/events/${saved.event_id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Event Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue">Venue</Label>
        <Select value={venueId} onValueChange={(v) => v && setVenueId(v)} required>
          <SelectTrigger id="venue">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-time">Start Date & Time</Label>
        <Input
          id="start-time"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="end-time">End Date & Time</Label>
        <Input
          id="end-time"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : isEditing ? "Save Changes" : "Create Event"}
      </Button>
    </form>
  );
}