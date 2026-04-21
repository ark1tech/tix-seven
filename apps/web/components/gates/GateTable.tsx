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
          <TableHead className="py-2 px-3 text-xs">Location</TableHead>
          <TableHead className="py-2 px-3 text-xs">Status</TableHead>
          <TableHead className="py-2 px-3 text-xs">Assigned Event</TableHead>
          <TableHead className="py-2 px-3" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {gates.map((gate, i) => (
          <TableRow key={gate.gate_id} className={cn(i % 2 === 1 && "bg-muted/40")}>
            <TableCell className="py-2 px-3 text-sm">{gate.location}</TableCell>
            <TableCell className="py-2 px-3">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                gate.status === "ONLINE"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500"
              )}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  gate.status === "ONLINE" ? "bg-emerald-500" : "bg-zinc-400"
                )} />
                {gate.status}
              </span>
            </TableCell>
            <TableCell className="py-2 px-3">
              <Select
                value={gate.event_id ?? "unassigned"}
                onValueChange={(v) =>
                  handleAssign(gate.gate_id, v === "unassigned" ? null : v)
                }
                disabled={loading === gate.gate_id}
              >
                <SelectTrigger className="w-48">
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
            </TableCell>
            <TableCell className="py-2 px-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(gate.gate_id)}
                disabled={loading === gate.gate_id}
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
