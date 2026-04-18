"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Event } from "@tix-seven/types";

interface Props {
  event?: Event;
}

export default function EventForm({ event }: Props) {
  const router = useRouter();
  const isEditing = !!event;

  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(
    event ? event.date.slice(0, 16) : ""
  );
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [capacity, setCapacity] = useState(
    event?.capacity?.toString() ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name,
      date: new Date(date).toISOString(),
      venue,
      capacity: parseInt(capacity, 10),
    };

    // TODO: implement full form submission with validation feedback
    const url = isEditing ? `/api/events/${event.id}` : "/api/events";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const saved = await res.json();
    router.push(`/events/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Event Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Date & Time</Label>
        <Input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue">Venue</Label>
        <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capacity">Capacity</Label>
        <Input id="capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : isEditing ? "Save Changes" : "Create Event"}
      </Button>
    </form>
  );
}
