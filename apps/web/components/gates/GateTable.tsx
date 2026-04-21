"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Gate, Event } from "@tix-seven/types";
import { cn } from "@/lib/utils";

interface Props {
  gates: Gate[];
  events: Event[];
}

export default function GateTable({ gates, events }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAssign(gateId: string, eventId: string | null) {
    setLoading(gateId);
    await fetch(`/api/gates/${gateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    });
    setLoading(null);
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDelete(gateId: string) {
    if (!window.confirm("Are you sure you want to remove this gate?")) return;
    setLoading(gateId);
    await fetch(`/api/gates/${gateId}`, { method: "DELETE" });
    setLoading(null);
    startTransition(() => {
      router.refresh();
    });
  }

  if (gates.length === 0) {
    return <p className="text-sm text-muted-foreground">No gates registered yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2 px-3 text-xs">Name</TableHead>
          <TableHead className="py-2 px-3 text-xs">Device ID</TableHead>
          <TableHead className="py-2 px-3 text-xs">Assigned Event</TableHead>
          <TableHead className="py-2 px-3" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {gates.map((gate, i) => (
          <TableRow key={gate.id} className={cn(i % 2 === 1 && "bg-muted/40")}>
            <TableCell className="py-2 px-3 text-sm">{gate.name}</TableCell>
            <TableCell className="py-2 px-3 font-mono text-xs">{gate.device_id}</TableCell>
            <TableCell className="py-2 px-3">
              <Select
                value={gate.event_id ?? "unassigned"}
                onValueChange={(v) =>
                  handleAssign(gate.id, v === "unassigned" ? null : v)
                }
                disabled={loading === gate.id}
              >
                <SelectTrigger className="w-48">
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
            </TableCell>
            <TableCell className="py-2 px-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(gate.id)}
                disabled={loading === gate.id}
              >
                Remove
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
