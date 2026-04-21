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
import type { Event } from "@tix-seven/types";

interface Props {
  events: Event[];
}

export default function GateForm({ events }: Props) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [eventId, setEventId] = useState<string>("unassigned");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/gates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location,
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

    setLocation("");
    setEventId("unassigned");
    setLoading(false);
    startTransition(() => {
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
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Registering…" : "Register Gate"}
      </Button>
    </form>
  );
}
