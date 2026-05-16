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
import { formatPhtTimeMedium, parsePhtEventTimestampToDate } from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import { Filter, ArrowUpDown } from "lucide-react";
import type { Log } from "@tix-seven/types";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

type ResultFilter = "All" | "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";
type SortDir = "Newest" | "Oldest";

function isResultFilter(v: string): v is ResultFilter {
  return ["All", "GRANTED", "DENIED", "TIMEOUT", "ERROR"].includes(v);
}

function isSortDir(v: string): v is SortDir {
  return v === "Newest" || v === "Oldest";
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function formatDenialReasonLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

type ResultMeta = {
  pill: string;
  dot: string;
  label: string;
};

const RESULT_META: Record<string, ResultMeta> = {
  GRANTED: {
    pill: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "Granted",
  },
  DENIED: {
    pill: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    label: "Denied",
  },
  TIMEOUT: {
    pill: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
    label: "Timeout",
  },
  ERROR: {
    pill: "bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
    label: "Error",
  },
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

interface Props {
  /** logs are passed in by the server component; no client-side realtime here */
  initialLogs: Log[];
}

export default function EntryLogFeed({ initialLogs }: Props) {
  const [logs] = useState<Log[]>(initialLogs);
  const [filter, setFilter] = useState<ResultFilter>("All");
  const [sort, setSort] = useState<SortDir>("Newest");

  const filteredLogs = logs.filter((log) => {
    if (filter === "All") return true;
    return log.result === filter;
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
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-4">
          Logs
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          {/* Result filter */}
          <Select
            modal={false}
            value={filter}
            onValueChange={(v) => { if (isResultFilter(v)) setFilter(v); }}
          >
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-[130px] p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="GRANTED">Granted</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
              <SelectItem value="TIMEOUT">Timeout</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            modal={false}
            value={sort}
            onValueChange={(v) => { if (isSortDir(v)) setSort(v); }}
          >
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

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="py-2 px-3 text-xs">Time</TableHead>
            {/* Gate column — uses gate_location_snapshot, durable after gate deletion */}
            <TableHead className="py-2 px-3 text-xs">Gate</TableHead>
            <TableHead className="py-2 px-3 text-xs">Result</TableHead>
            <TableHead className="py-2 px-3 text-xs">Reason</TableHead>
            <TableHead className="py-2 px-3 text-xs">Ticket ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLogs.map((log, i) => {
            const meta = RESULT_META[log.result] ?? {
              pill: "bg-zinc-100 text-zinc-600",
              dot: "bg-zinc-400",
              label: log.result,
            };

            return (
              <TableRow key={log.log_id} className={cn(i % 2 === 1 && "bg-muted/40")}>
                {/* Time */}
                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                  <time dateTime={log.timestamp.replace(" ", "T")}>
                    {formatPhtTimeMedium(log.timestamp)}
                  </time>
                </TableCell>

                {/* Gate — snapshot column, always present after _resolve_gate succeeds */}
                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                  {log.gate_location_snapshot ?? (
                    <span className="text-muted-foreground/40 font-mono">
                      {log.raw_gate_id_snapshot.slice(0, 8)}…
                    </span>
                  )}
                </TableCell>

                {/* Result pill */}
                <TableCell className="py-2 px-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      meta.pill
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </TableCell>

                {/* Denial reason */}
                <TableCell className="py-2 px-3 text-sm">
                  {log.denial_reason
                    ? formatDenialReasonLabel(log.denial_reason)
                    : "—"}
                </TableCell>

                {/* Ticket ID */}
                <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground">
                  {log.ticket_id ? `${log.ticket_id.slice(0, 8)}…` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}