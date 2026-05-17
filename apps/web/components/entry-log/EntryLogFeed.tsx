"use client";

import { useEffect, useState, useMemo } from "react";
import { useRegisterExportSnapshot } from "@/components/events/event-export-context";
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
import {
  formatPhtDateTimeMedium,
  parsePhtEventTimestampToDate,
} from "@/lib/datetime-pht";
import { CopyableId } from "@/components/ui/copyable-id";
import { cn } from "@/lib/utils";
import { Filter, ArrowUpDown } from "lucide-react";
import {
  ENTRY_LOG_TABS,
  RegistryChipTabs,
} from "@/components/events/RegistryChipTabs";
import {
  matchesRegistrySearch,
  RegistryTableSearch,
} from "@/components/events/RegistryTableSearch";
import type { Log } from "@tix-seven/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ResultFilter = "All" | "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";
type SortDir = "Newest" | "Oldest";

function isResultFilter(v: string): v is ResultFilter {
  return ["All", "GRANTED", "DENIED", "TIMEOUT", "ERROR"].includes(v);
}

function isSortDir(v: string): v is SortDir {
  return v === "Newest" || v === "Oldest";
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDenialReasonLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

type ResultMeta = { pill: string; dot: string; label: string };

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

function logSearchFields(log: Log): string[] {
  const resultMeta = RESULT_META[log.result];
  const reasonLabel = log.denial_reason
    ? formatDenialReasonLabel(log.denial_reason)
    : "";

  return [
    log.ticket_id ?? "",
    log.denial_reason ?? "",
    reasonLabel,
    log.gate_location_snapshot ?? "",
    log.raw_gate_id_snapshot,
    log.result,
    resultMeta?.label ?? log.result,
  ];
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface Props {
  eventId: string;
  initialLogs: Log[];
}

export default function EntryLogFeed({ eventId, initialLogs }: Props) {
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [filter, setFilter] = useState<ResultFilter>("All");
  const [sort, setSort] = useState<SortDir>("Newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Gate-server owns the initial fetch (server component passes initialLogs).
  // Supabase realtime owns live push after page load. Both paths coexist without conflict as they operate on different layers.
  useEffect(() => {
    const unsub = subscribeToEntryLogs(eventId, (newLog) => {
      setLogs((prev) => {
        // Both broadcast and postgres_changes can fire for the same INSERT.

        // Deduplicate by log_id so the fallback path never double-renders.
        if (prev.some((l) => l.log_id === newLog.log_id)) return prev;
        return [newLog, ...prev];
      });
    });
    return unsub;
  }, [eventId]);

  const sortedLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      if (filter !== "All" && log.result !== filter) return false;
      return matchesRegistrySearch(logSearchFields(log), searchQuery);
    });

    return [...filtered].sort((a, b) => {
      const timeA = parsePhtEventTimestampToDate(a.timestamp).getTime();
      const timeB = parsePhtEventTimestampToDate(b.timestamp).getTime();
      return sort === "Newest" ? timeB - timeA : timeA - timeB;
    });
  }, [logs, filter, sort, searchQuery]);

  const exportSnapshot = useMemo(
    () => ({ registry: "logs" as const, rows: sortedLogs }),
    [sortedLogs],
  );
  useRegisterExportSnapshot(exportSnapshot);

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
        <RegistryChipTabs
          tabs={ENTRY_LOG_TABS}
          value="logs"
          ariaLabel="Entry log"
        />
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          <Select
            modal={false}
            value={filter}
            onValueChange={(v) => {
              if (isResultFilter(v!)) setFilter(v);
            }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-32.5 p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="GRANTED">Granted</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
              <SelectItem value="TIMEOUT">Timeout</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select
            modal={false}
            value={sort}
            onValueChange={(v) => {
              if (isSortDir(v!)) setSort(v);
            }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-30 p-1">
              <SelectItem value="Newest">Newest</SelectItem>
              <SelectItem value="Oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          <RegistryTableSearch
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search"
          />
        </div>
      </div>

      {/* Table */}
      {sortedLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground p-3">
          No logs found matching the criteria.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-3 text-xs">Ticket ID</TableHead>
              <TableHead className="py-2 px-3 text-xs">Result</TableHead>
              <TableHead className="py-2 px-3 text-xs">Reason</TableHead>
              <TableHead className="py-2 px-3 text-xs">Time</TableHead>
              {/* gate_location_snapshot is durable even after the Gate row is deleted */}
              <TableHead className="py-2 px-3 text-xs">Gate</TableHead>
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
                <TableRow
                  key={log.log_id}
                  className={cn(i % 2 === 1 && "bg-muted/40")}>
                  {/* Ticket ID */}
                  <TableCell className="py-2 px-3 overflow-hidden">
                    <CopyableId id={log.ticket_id} />
                  </TableCell>

                  {/* Result */}
                  <TableCell className="py-2 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        meta.pill,
                      )}>
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
                      />
                      {meta.label}
                    </span>
                  </TableCell>

                  {/* Denial Reason */}
                  <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                    {log.denial_reason
                      ? formatDenialReasonLabel(log.denial_reason)
                      : "—"}
                  </TableCell>

                  {/* Time */}
                  <TableCell className="py-2 px-3 text-xs text-muted-foreground overflow-hidden">
                    <time
                      className="block truncate"
                      dateTime={log.timestamp.replace(" ", "T")}>
                      {formatPhtDateTimeMedium(log.timestamp)}
                    </time>
                  </TableCell>

                  {/* Gate prefers location snapshot; falls back to truncated raw_gate_id_snapshot when _resolve_gate failed before the snapshot could be written (e.g. INVALID_GATE_ID) */}
                  <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                    {log.gate_location_snapshot ?? (
                      <span className="font-mono text-muted-foreground/50">
                        {log.raw_gate_id_snapshot.slice(0, 8)}…
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
