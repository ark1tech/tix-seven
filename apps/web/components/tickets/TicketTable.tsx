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
import { Filter, ArrowUpDown, Copy, Check } from "lucide-react";

type TicketFilter = "All" | "Active" | "Used";
type TicketSort = "Newest" | "Oldest";

function isTicketFilter(value: string | null): value is TicketFilter {
  return value === "All" || value === "Active" || value === "Used";
}

function isTicketSort(value: string | null): value is TicketSort {
  return value === "Newest" || value === "Oldest";
}

function CopyableId({ id, className }: { id: string | null; className?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  if (!id) return <span className="text-muted-foreground/40 font-mono text-xs px-2">—</span>;

  return (
    <div 
      className={cn(
        "group relative flex items-center justify-between cursor-pointer w-full gap-2 transition-all duration-200 px-2 py-1.5 rounded-md border border-transparent hover:border-border/40 hover:bg-muted/30",
        className
      )}
      onClick={onCopy}
      title={id}
    >
      <span className="font-mono text-xs text-muted-foreground font-medium leading-none truncate flex-1">
        {id}
      </span>
      <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0">
        <Check className={cn(
          "h-3 w-3 text-emerald-500 transition-all duration-300 absolute",
          copied ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
        )} />
        <Copy className={cn(
          "h-3 w-3 text-muted-foreground transition-all duration-200 absolute",
          copied ? "opacity-0 scale-50" : "opacity-0 group-hover:opacity-40 scale-100"
        )} />
      </div>
    </div>
  );
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
          // UPDATE path: merge fields but never clobber an existing value with
          // null/undefined. This handles both the enriched broadcast payload
          // (full Ticket) and the postgres_changes fallback (partial — no
          // link_hash column on the ticket table).
          const existing = prev[index];
          const merged: Ticket = {
            ...existing,
            ...updatedTicket,
            link_hash: updatedTicket.link_hash ?? existing.link_hash,
          };
          const next = [...prev];
          next[index] = merged;
          return next;
        } else {
          // INSERT path: only add if link_hash is present — the broadcast can
          // fire before the event_ticket_link join is visible, yielding null.
          if (!updatedTicket.link_hash) return prev;
          // Prevent duplicates if multiple realtime paths fire
          if (prev.some((t) => t.ticket_id === updatedTicket.ticket_id)) return prev;
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
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="py-2 px-3 text-xs w-1/5">Ticket ID</TableHead>
              <TableHead className="py-2 px-3 text-xs w-1/5">Link Hash</TableHead>
              <TableHead className="py-2 px-3 text-xs">Status</TableHead>
              <TableHead className="py-2 px-3 text-xs">Issued At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTickets.map((ticket, i) => (
              <TableRow key={ticket.ticket_id} className="group transition-colors">
                <TableCell className="py-2 px-1 w-1/5 max-w-0">
                  <CopyableId id={ticket.ticket_id} />
                </TableCell>
                <TableCell className="py-2 px-1 w-1/5 max-w-0">
                  <CopyableId id={ticket.link_hash} />
                </TableCell>
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
