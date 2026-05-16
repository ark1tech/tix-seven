import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { LogSummary, TicketSummary } from "@tix-seven/types";

interface Props {
  ticketSummary: TicketSummary;
  logSummary: LogSummary;
  capacity: number;
  className?: string;
}

export function EventOverviewCard({
  ticketSummary,
  logSummary,
  capacity,
  className,
}: Props) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="grid gap-5 px-5 pb-5 lg:grid-cols-[1fr_1fr]">
        <TicketCompactAnalytics
          summary={ticketSummary}
          capacity={capacity}
        />

        <GateCompactAnalytics summary={logSummary} />
      </CardContent>
    </Card>
  );
}

function TicketCompactAnalytics({
  summary,
  capacity,
}: {
  summary: TicketSummary;
  capacity: number;
}) {
  const { total, used, unused } = summary;

  const safeCapacity = Math.max(capacity, 0);
  const remaining = Math.max(safeCapacity - total, 0);

  const usedPct = safeCapacity > 0 ? Math.min((used / safeCapacity) * 100, 100) : 0;
  const unusedPct = safeCapacity > 0 ? Math.min((unused / safeCapacity) * 100, 100) : 0;
  const remainingPct =
    safeCapacity > 0 ? Math.max(100 - usedPct - unusedPct, 0) : 0;

  const issuedPct =
    safeCapacity > 0 ? Math.min((total / safeCapacity) * 100, 100) : 0;

  return (
    <section className="rounded-xl bg-gradient-to-br from-amber-500/10 via-background to-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
            <Ticket className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-medium">Ticket Issuance</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {total}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">
                / {capacity}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">
            {issuedPct.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground">issued</p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          <Segment value={usedPct} className="bg-emerald-500" />
          <Segment value={unusedPct} className="bg-slate-400" />
          <Segment value={remainingPct} className="bg-muted" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactMetric label="Used" value={used} dotClassName="bg-emerald-500" />
        <CompactMetric label="Unused" value={unused} dotClassName="bg-slate-400" />
        <CompactMetric label="Remaining" value={remaining} dotClassName="bg-muted-foreground/40" />
      </div>
    </section>
  );
}

function GateCompactAnalytics({ summary }: { summary: LogSummary }) {
  const { total, granted, denied, timeout_or_error } = summary;

  const hasIssues = denied > 0 || timeout_or_error > 0;

  return (
    <section className="rounded-xl bg-gradient-to-br from-violet-500/10 via-background to-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2 text-violet-600">
            <Activity className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-medium">Gate Activity</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
              {total}
            </p>
          </div>
        </div>

        <Badge
          className={cn(
            "rounded-full px-2.5",
            hasIssues
              ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10"
              : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10"
          )}
        >
          {hasIssues ? "Needs Review" : "Healthy"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatusPill
          icon={CheckCircle2}
          label="Granted"
          value={granted}
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
        />
        <StatusPill
          icon={XCircle}
          label="Denied"
          value={denied}
          className="border-red-500/20 bg-red-500/10 text-red-700"
        />
        <StatusPill
          icon={AlertTriangle}
          label="Errors"
          value={timeout_or_error}
          className="border-amber-500/20 bg-amber-500/10 text-amber-700"
        />
      </div>
    </section>
  );
}

function Segment({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn("h-full transition-all duration-500", className)}
      style={{ width: `${Math.max(value, 0)}%` }}
    />
  );
}

function CompactMetric({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", className)}>
      <div className="flex items-center gap-1.5 text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}