"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
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

type LoadingAction = "status" | "assign" | "delete";

export default function GateTable({ gates, events }: Props) {
  const router = useRouter();
  // Track which gate + which action is loading: `${gateId}:${action}`
  const [loading, setLoading] = useState<string | null>(null);

  function isLoading(gateId: string, action: LoadingAction) {
    return loading === `${gateId}:${action}`;
  }

  function isAnyLoading(gateId: string) {
    return loading?.startsWith(`${gateId}:`) ?? false;
  }

  async function handleStatusChange(gateId: string, next: "ONLINE" | "OFFLINE") {
    setLoading(`${gateId}:status`);
    await fetch(`/api/gates/${gateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(null);
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleAssign(gateId: string, eventId: string | null) {
    setLoading(`${gateId}:assign`);
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
    setLoading(`${gateId}:delete`);
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
        <TableRow className="hover:bg-transparent border-b">
          <TableHead className="py-2 px-3 text-xs">Location</TableHead>
          <TableHead className="py-2 px-3 text-xs">Status</TableHead>
          <TableHead className="py-2 px-3 text-xs">Assigned Event</TableHead>
          <TableHead className="py-2 px-3" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {gates.map((gate) => (
          <TableRow key={gate.gate_id} className="group transition-colors">
            <TableCell className="py-2 px-3 text-sm font-medium">
              <Link 
                href={`/gates/${gate.gate_id}`}
                className="hover:underline underline-offset-4 text-primary"
              >
                {gate.location}
              </Link>
            </TableCell>
            <TableCell className="py-2 px-3">
              <Select
                value={gate.status}
                onValueChange={(v) => v && handleStatusChange(gate.gate_id, v as "ONLINE" | "OFFLINE")}
                disabled={isAnyLoading(gate.gate_id)}
              >
                <SelectTrigger 
                  className={cn(
                    "w-fit min-w-[100px] h-8 text-xs font-medium transition-colors",
                    gate.status === "ONLINE"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isLoading(gate.gate_id, "status")
                          ? "animate-pulse bg-current"
                          : gate.status === "ONLINE"
                            ? "bg-emerald-500"
                            : "bg-zinc-400"
                      )}
                    />
                    <SelectValue>
                      {isLoading(gate.gate_id, "status") ? "Saving..." : gate.status === "ONLINE" ? "Online" : "Offline"}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONLINE" className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Online
                    </div>
                  </SelectItem>
                  <SelectItem value="OFFLINE" className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      Offline
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="py-2 px-3">
              <Select
                value={gate.event_id ?? "unassigned"}
                onValueChange={(v) =>
                  handleAssign(gate.gate_id, v === "unassigned" ? null : v)
                }
                disabled={isAnyLoading(gate.gate_id)}
              >
                <SelectTrigger className="w-fit min-w-32">
                  <SelectValue>
                    {events.find(e => e.event_id === gate.event_id)?.name ?? "Unassigned"}
                  </SelectValue>
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
                className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors cursor-pointer"
                onClick={() => handleDelete(gate.gate_id)}
                disabled={isAnyLoading(gate.gate_id)}
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
