import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketSummary } from "@tix-seven/types";

interface Props {
  summary: TicketSummary;
  capacity: number;
  className?: string;
}

export function TicketSummaryBar({ summary, capacity, className }: Props) {
  const { total_issued, total_used, total_unused } = summary;
  const issuedPct = capacity > 0 ? Math.min((total_issued / capacity) * 100, 100) : 0;
  const usedPct = total_issued > 0 ? Math.min((total_used / total_issued) * 100, 100) : 0;

  return (
    <div className={cn("rounded-xl border bg-card px-5 py-4 flex flex-col gap-3", className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Ticket className="h-4 w-4 text-amber-500 shrink-0" />
          Ticket Issuance
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total_issued} / {capacity} capacity
        </span>
      </div>

      {/* Issuance progress bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${issuedPct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {issuedPct.toFixed(0)}% of capacity issued
        </p>
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <StatPill
          value={total_issued}
          label="Issued"
          dotClass="bg-amber-400"
          pillClass="bg-amber-50 border-amber-100 text-amber-700"
        />
        <StatPill
          value={total_used}
          label="Used"
          dotClass="bg-emerald-400"
          pillClass="bg-emerald-50 border-emerald-100 text-emerald-700"
        />
        <StatPill
          value={total_unused}
          label="Unused"
          dotClass="bg-zinc-300"
          pillClass="bg-zinc-50 border-zinc-200 text-zinc-600"
        />
        {/* Entry rate — derived */}
        {total_issued > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {usedPct.toFixed(0)}% entry rate
          </span>
        )}
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  dotClass,
  pillClass,
}: {
  value: number;
  label: string;
  dotClass: string;
  pillClass: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        pillClass
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </span>
  );
}