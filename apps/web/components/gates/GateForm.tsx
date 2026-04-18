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
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
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
        name,
        device_id: deviceId,
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

    setName("");
    setDeviceId("");
    setEventId("unassigned");
    setLoading(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gate-name">Gate Name</Label>
        <Input
          id="gate-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gate A"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="device-id">Device ID</Label>
        <Input
          id="device-id"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="e.g. ESP8266-001"
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
              <SelectItem key={event.id} value={event.id}>
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
