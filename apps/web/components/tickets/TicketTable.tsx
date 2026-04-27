"use client";

import { useState, useEffect } from "react";
import { subscribeToTickets } from "@/lib/db/tickets-realtime";
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
import { formatPhtDateTimeShort, parsePhtEventTimestampToDate } from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import type { Ticket } from "@tix-seven/types";
import { Filter, ArrowUpDown } from "lucide-react";

type TicketFilter = "All" | "Active" | "Used";
type TicketSort = "Newest" | "Oldest";

function isTicketFilter(value: string | null): value is TicketFilter {
  return value === "All" || value === "Active" || value === "Used";
}

function isTicketSort(value: string | null): value is TicketSort {
  return value === "Newest" || value === "Oldest";
}

export default function TicketTable({ eventId, initialTickets }: { eventId: string, initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [filter, setFilter] = useState<TicketFilter>("All");
  const [sort, setSort] = useState<TicketSort>("Newest");

  useEffect(() => {
    const unsub = subscribeToTickets(eventId, (updatedTicket) => {
      setTickets((prev) => {
        const index = prev.findIndex((t) => t.ticket_id === updatedTicket.ticket_id);
        if (index !== -1) {
          // UPDATE path: merge but never clobber an existing link_hash with null
          const existing = prev[index];
          const merged: Ticket = {
            ...existing,
            ...updatedTicket,
            link_hash: updatedTicket.link_hash ?? existing.link_hash,
          };
          const newTickets = [...prev];
          newTickets[index] = merged;
          return newTickets;
        } else {
          // INSERT path: only add if link_hash is present — the broadcast can
          // fire before the event_ticket_link join is visible, yielding null.
          if (!updatedTicket.link_hash) return prev;
          return [updatedTicket as Ticket, ...prev];
        }
      });
    });
    return unsub;
  }, [eventId]);

  const filteredTickets = tickets.filter((t) => {
    if (filter === "Active") return t.status !== "USED";
    if (filter === "Used") return t.status === "USED";
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const timeA = parsePhtEventTimestampToDate(a.created_at).getTime();
    const timeB = parsePhtEventTimestampToDate(b.created_at).getTime();
    return sort === "Newest" ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-4">Ticket Registry</h2>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          <Select modal={false} value={filter} onValueChange={(v) => {
            if (isTicketFilter(v)) setFilter(v);
          }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-[120px] p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Used">Used</SelectItem>
            </SelectContent>
          </Select>

          <Select modal={false} value={sort} onValueChange={(v) => {
            if (isTicketSort(v)) setSort(v);
          }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-[120px] p-1">
              <SelectItem value="Newest">Newest</SelectItem>
              <SelectItem value="Oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedTickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tickets found matching the criteria.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-3 text-xs">Ticket ID</TableHead>
              <TableHead className="py-2 px-3 text-xs">Link Hash</TableHead>
              <TableHead className="py-2 px-3 text-xs">Status</TableHead>
              <TableHead className="py-2 px-3 text-xs">Issued At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTickets.map((ticket, i) => (
              <TableRow key={ticket.ticket_id} className={i % 2 === 1 ? "bg-muted/40" : undefined}>
                <TableCell className="py-2 px-3 font-mono text-xs">{ticket.ticket_id.slice(0, 8)}…</TableCell>
                <TableCell className="py-2 px-3 font-mono text-xs">{ticket.link_hash?.slice(0, 12) ?? "—"}…</TableCell>
                <TableCell className="py-2 px-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ticket.status === "USED"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  )}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ticket.status === "USED" ? "bg-red-500" : "bg-emerald-500"
                    )} />
                    {ticket.status === "USED" ? "Used" : "Unused"}
                  </span>
                </TableCell>
                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                  <time dateTime={ticket.created_at.replace(" ", "T")}>
                    {formatPhtDateTimeShort(ticket.created_at)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
