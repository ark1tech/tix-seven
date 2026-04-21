"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Ticket } from "@tix-seven/types";
import { Filter, ArrowUpDown } from "lucide-react";

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState<"All" | "Active" | "Used">("All");
  const [sort, setSort] = useState<"Newest" | "Oldest">("Newest");

  const filteredTickets = tickets.filter((t) => {
    if (filter === "Active") return t.status !== "USED";
    if (filter === "Used") return t.status === "USED";
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sort === "Newest" ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-4">Ticket Registry</h2>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          <Select modal={false} value={filter} onValueChange={(v) => { if (v) setFilter(v as any); }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-[open]:bg-muted/80 data-[open]:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-[120px] p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Used">Used</SelectItem>
            </SelectContent>
          </Select>

          <Select modal={false} value={sort} onValueChange={(v) => { if (v) setSort(v as any); }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-[open]:bg-muted/80 data-[open]:text-foreground rounded-md">
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
                <TableCell className="py-2 px-3 font-mono text-xs">{ticket.link_hash.slice(0, 12)}…</TableCell>
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
                    {ticket.status === "USED" ? "Used" : "Active"}
                  </span>
                </TableCell>
                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                  <time suppressHydrationWarning>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(ticket.created_at))}
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
