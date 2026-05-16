import { ScanLine, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogSummary } from "@tix-seven/types";

interface Props {
  summary: LogSummary;
  className?: string;
}

function formatDenialLabel(reason: string): string {
  return reason
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function LogSummaryBar({ summary, className }: Props) {
  const { total, granted, denied, timeout_or_error, denial_breakdown } = summary;
  const grantRate = total > 0 ? Math.min((granted / total) * 100, 100) : 0;
  const hasDenials = denial_breakdown && denial_breakdown.length > 0;

  return (
    <div className={cn("rounded-xl border bg-card px-5 py-4 flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ScanLine className="h-4 w-4 text-violet-500 shrink-0" />
          Gate Activity
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} total scan{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grant-rate bar */}
      {total > 0 && (
        <div className="space-y-1">
          {/* Segmented bar: granted / denied / timeout+error */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${grantRate}%` }}
            />
            {denied > 0 && (
              <div
                className="h-full bg-red-400 transition-all duration-500"
                style={{ width: `${(denied / total) * 100}%` }}
              />
            )}
            {timeout_or_error > 0 && (
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${(timeout_or_error / total) * 100}%` }}
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {grantRate.toFixed(0)}% grant rate
          </p>
        </div>
      )}

      {/* Stat pills */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <StatPill
          icon={CheckCircle2}
          value={granted}
          label="Granted"
          dotClass="bg-emerald-400"
          pillClass="bg-emerald-50 border-emerald-100 text-emerald-700"
        />
        <StatPill
          icon={XCircle}
          value={denied}
          label="Denied"
          dotClass="bg-red-400"
          pillClass="bg-red-50 border-red-100 text-red-700"
        />
        {timeout_or_error > 0 && (
          <StatPill
            icon={AlertTriangle}
            value={timeout_or_error}
            label="Errors"
            dotClass="bg-amber-400"
            pillClass="bg-amber-50 border-amber-100 text-amber-700"
          />
        )}
      </div>

      {/* Denial breakdown */}
      {hasDenials && (
        <div className="border-t pt-3 mt-0.5 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Denial Reasons
          </p>
          {denial_breakdown.map(({ reason, count }) => (
            <div key={reason} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate">
                {formatDenialLabel(reason)}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {/* Mini inline bar */}
                <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-red-300 rounded-full"
                    style={{
                      width: denied > 0 ? `${Math.min((count / denied) * 100, 100)}%` : "0%",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground w-5 text-right">
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  value,
  label,
  dotClass,
  pillClass,
}: {
  icon: React.ElementType;
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