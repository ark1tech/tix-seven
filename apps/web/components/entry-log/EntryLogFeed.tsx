"use client";

import { useEffect, useState } from "react";
import { subscribeToEntryLogs } from "@/lib/db/entry-logs-realtime";
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
import { formatPhtTimeMedium, parsePhtEventTimestampToDate } from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import type { Log } from "@tix-seven/types";

function formatDenialReasonLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
import { Filter, ArrowUpDown } from "lucide-react";

interface Props {
  eventId: string;
  initialLogs: Log[];
}

export default function EntryLogFeed({ eventId, initialLogs }: Props) {
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [filter, setFilter] = useState<"All" | "Granted" | "Denied">("All");
  const [sort, setSort] = useState<"Newest" | "Oldest">("Newest");

  useEffect(() => {
    const unsub = subscribeToEntryLogs(
      eventId,
      (newLog) => setLogs((prev) => {
        // Prevent duplicates from multiple realtime paths (broadcast + postgres_changes)
        if (prev.some(log => log.log_id === newLog.log_id)) return prev;
        return [newLog, ...prev];
      })
    );
    return unsub;
  }, [eventId]);

  const filteredLogs = logs.filter((log) => {
    if (filter === "All") return true;
    if (filter === "Granted") return log.result === "GRANTED";
    if (filter === "Denied") return log.result !== "GRANTED";
    return true;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const timeA = parsePhtEventTimestampToDate(a.timestamp).getTime();
    const timeB = parsePhtEventTimestampToDate(b.timestamp).getTime();
    return sort === "Newest" ? timeB - timeA : timeA - timeB;
  });

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scan attempts yet. Waiting for gate activity…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-4">Logs</h2>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          <Select modal={false} value={filter} onValueChange={(v) => {
              if (v === "All" || v === "Granted" || v === "Denied") setFilter(v);
            }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-[120px] p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Granted">Granted</SelectItem>
              <SelectItem value="Denied">Denied</SelectItem>
            </SelectContent>
          </Select>

          <Select modal={false} value={sort} onValueChange={(v) => {
              if (v === "Newest" || v === "Oldest") setSort(v);
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

      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2 px-3 text-xs">Time</TableHead>
          <TableHead className="py-2 px-3 text-xs">Result</TableHead>
          <TableHead className="py-2 px-3 text-xs">Reason</TableHead>
          <TableHead className="py-2 px-3 text-xs">Ticket ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedLogs.map((log, i) => (
          <TableRow key={log.log_id} className={cn(i % 2 === 1 && "bg-muted/40")}>
            <TableCell className="py-2 px-3 text-xs text-muted-foreground">
              <time dateTime={log.timestamp.replace(" ", "T")}>
                {formatPhtTimeMedium(log.timestamp)}
              </time>
            </TableCell>
            <TableCell className="py-2 px-3">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                log.result === "GRANTED"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  log.result === "GRANTED" ? "bg-emerald-500" : "bg-red-500"
                )} />
                {log.result === "GRANTED" ? "Granted" : log.result}
              </span>
            </TableCell>
            <TableCell className="py-2 px-3 text-sm">
              {log.denial_reason
                ? formatDenialReasonLabel(log.denial_reason)
                : "—"}
            </TableCell>
            <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground">
              {log.ticket_id ? `${log.ticket_id.slice(0, 8)}…` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
