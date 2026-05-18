"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import type { TooltipPayload } from "recharts";
import { AlertTriangle } from "lucide-react";
import type { DenialReason, Log } from "@tix-seven/types";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { RegistryChipTabs } from "@/components/events/RegistryChipTabs";
import {
  parsePhtEventTimestampToDate,
  PHT_IANA,
  PHT_LOCALE,
} from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";

const WINDOW_MINUTES = 15;
const BUCKET_MS = 60_000;
const FAILURE_WARNING_THRESHOLD = 0.3;
const STALL_BUCKET_COUNT = 3;
const ALL_GATES = "__all_gates__";

type GateOption = {
  id: string;
  label: string;
};

type MutableBucket = {
  startsAt: Date;
  label: string;
  granted: number;
  denied: number;
  timeoutOrError: number;
  denialReasonCounts: Map<DenialReason, number>;
};

type GateFlowBucket = {
  startsAt: Date;
  label: string;
  granted: number;
  denied: number;
  timeoutOrError: number;
  total: number;
  topDenialReasonLabel: string;
  topDenialReasonCount: number;
  warning: boolean;
};

const chartConfig = {
  granted: {
    label: "Granted",
    color: "oklch(0.68 0.12 155)",
  },
  denied: {
    label: "Denied",
    color: "var(--chart-3)",
  },
  timeoutOrError: {
    label: "Timeout/Error",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const CHART_HEIGHT_PX = 148;
const Y_AXIS_WIDTH = 32;
const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const PLOT_LEFT_INSET = CHART_MARGIN.left + Y_AXIS_WIDTH;
const Y_AXIS_TICK_MAX_EXPLICIT = 6;

const timeFormatter = new Intl.DateTimeFormat(PHT_LOCALE, {
  timeZone: PHT_IANA,
  hour: "numeric",
  minute: "2-digit",
});

function formatDenialReasonLabel(value: DenialReason): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function getGateLabel(log: Log): string {
  if (log.gate_location_snapshot) {
    return log.gate_location_snapshot;
  }

  return `${log.raw_gate_id_snapshot.slice(0, 8)}...`;
}

function getGateOptions(logs: Log[]): GateOption[] {
  const seen = new Set<string>();
  return logs.reduce<GateOption[]>((options, log) => {
    const label = getGateLabel(log);
    if (seen.has(label)) {
      return options;
    }

    seen.add(label);
    return [...options, { id: label, label }];
  }, []);
}

function createEmptyBuckets(anchor: Date): MutableBucket[] {
  const anchorMinute = Math.floor(anchor.getTime() / BUCKET_MS) * BUCKET_MS;
  const firstBucket = anchorMinute - (WINDOW_MINUTES - 1) * BUCKET_MS;

  return Array.from({ length: WINDOW_MINUTES }, (_, index) => {
    const startsAt = new Date(firstBucket + index * BUCKET_MS);

    return {
      startsAt,
      label: timeFormatter.format(startsAt),
      granted: 0,
      denied: 0,
      timeoutOrError: 0,
      denialReasonCounts: new Map<DenialReason, number>(),
    };
  });
}

function getTopDenialReason(
  counts: Map<DenialReason, number>,
): Pick<GateFlowBucket, "topDenialReasonLabel" | "topDenialReasonCount"> {
  let topReason: DenialReason | null = null;
  let topCount = 0;

  for (const [reason, count] of counts.entries()) {
    if (count > topCount) {
      topReason = reason;
      topCount = count;
    }
  }

  return {
    topDenialReasonLabel: topReason
      ? formatDenialReasonLabel(topReason)
      : "None",
    topDenialReasonCount: topCount,
  };
}

function bucketLogs(
  logs: Log[],
  selectedGate: string,
  anchor: Date,
): GateFlowBucket[] {
  const buckets = createEmptyBuckets(anchor);
  const firstBucketTime = buckets[0]?.startsAt.getTime();
  if (firstBucketTime === undefined) {
    return [];
  }

  for (const log of logs) {
    const gateLabel = getGateLabel(log);
    if (selectedGate !== ALL_GATES && gateLabel !== selectedGate) {
      continue;
    }

    const timestamp = parsePhtEventTimestampToDate(log.timestamp).getTime();
    if (Number.isNaN(timestamp)) {
      continue;
    }

    const index = Math.floor((timestamp - firstBucketTime) / BUCKET_MS);
    const bucket = buckets[index];
    if (!bucket) {
      continue;
    }

    if (log.result === "GRANTED") {
      bucket.granted += 1;
    } else if (log.result === "DENIED") {
      bucket.denied += 1;
      if (log.denial_reason) {
        bucket.denialReasonCounts.set(
          log.denial_reason,
          (bucket.denialReasonCounts.get(log.denial_reason) ?? 0) + 1,
        );
      }
    } else {
      bucket.timeoutOrError += 1;
    }
  }

  return buckets.map((bucket) => {
    const total = bucket.granted + bucket.denied + bucket.timeoutOrError;
    const failureTotal = bucket.denied + bucket.timeoutOrError;

    return {
      startsAt: bucket.startsAt,
      label: bucket.label,
      granted: bucket.granted,
      denied: bucket.denied,
      timeoutOrError: bucket.timeoutOrError,
      total,
      ...getTopDenialReason(bucket.denialReasonCounts),
      warning: total > 0 && failureTotal / total >= FAILURE_WARNING_THRESHOLD,
    };
  });
}

function hasStalledAdmission(buckets: GateFlowBucket[]): boolean {
  let stalledCount = 0;

  for (const bucket of buckets) {
    if (bucket.total > 0 && bucket.granted === 0) {
      stalledCount += 1;
      if (stalledCount >= STALL_BUCKET_COUNT) {
        return true;
      }
    } else {
      stalledCount = 0;
    }
  }

  return false;
}

function getTooltipBucket(payload: TooltipPayload | undefined) {
  const [firstPayload] = payload ?? [];
  const bucket = firstPayload?.payload;

  if (typeof bucket === "object" && bucket !== null) {
    return bucket as GateFlowBucket;
  }

  return null;
}

function getYAxisMax(buckets: GateFlowBucket[]): number {
  const peak = buckets.reduce((max, bucket) => Math.max(max, bucket.total), 0);
  return Math.max(peak, 1);
}

function getYAxisTicks(max: number): number[] {
  if (max <= Y_AXIS_TICK_MAX_EXPLICIT) {
    return Array.from({ length: max + 1 }, (_, index) => index);
  }

  const tickCount = 5;
  const step = Math.max(1, Math.ceil(max / (tickCount - 1)));
  const ticks: number[] = [];

  for (let value = 0; value <= max; value += step) {
    ticks.push(value);
  }

  const lastTick = ticks[ticks.length - 1];
  if (lastTick !== max) {
    ticks.push(max);
  }

  return ticks;
}

type AxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value: string | number };
};

function GateFlowYAxisTick({ x, y, payload }: AxisTickProps) {
  if (x === undefined || y === undefined || payload === undefined) {
    return null;
  }

  return (
    <text
      x={x}
      y={y}
      dx={-6}
      textAnchor="end"
      style={{ fontVariantNumeric: "tabular-nums" }}
      className="fill-muted-foreground text-[10px]">
      {payload.value}
    </text>
  );
}

function GateFlowXAxisTick({ x, y, payload }: AxisTickProps) {
  if (x === undefined || y === undefined || payload === undefined) {
    return null;
  }

  const label = String(payload.value ?? "");
  if (label.length === 0) {
    return null;
  }

  return (
    <text
      x={x}
      y={y}
      dy={6}
      textAnchor="middle"
      className="fill-muted-foreground text-[10px]">
      {label}
    </text>
  );
}

function getLatestScanAnchor(logs: Log[]): Date {
  const latestTime = logs.reduce<number | null>((latest, log) => {
    const timestamp = parsePhtEventTimestampToDate(log.timestamp).getTime();
    if (Number.isNaN(timestamp)) {
      return latest;
    }

    return latest === null ? timestamp : Math.max(latest, timestamp);
  }, null);

  return latestTime === null ? new Date() : new Date(latestTime);
}

export default function GateFlowChart({ logs }: { logs: Log[] }) {
  const [selectedGate, setSelectedGate] = useState<string>(ALL_GATES);

  const gateOptions = useMemo(() => getGateOptions(logs), [logs]);
  const gateTabs = useMemo(
    () => [{ id: ALL_GATES, label: "All gates" }, ...gateOptions],
    [gateOptions],
  );
  const latestScanAnchor = useMemo(() => getLatestScanAnchor(logs), [logs]);
  const chartData = useMemo(
    () => bucketLogs(logs, selectedGate, latestScanAnchor),
    [logs, selectedGate, latestScanAnchor],
  );
  const stalledAdmission = useMemo(
    () => hasStalledAdmission(chartData),
    [chartData],
  );
  const warningBuckets = chartData.filter((bucket) => bucket.warning).length;
  const yAxisMax = useMemo(() => getYAxisMax(chartData), [chartData]);
  const yAxisTicks = useMemo(() => getYAxisTicks(yAxisMax), [yAxisMax]);
  const selectedGateLabel =
    selectedGate === ALL_GATES ? "All gates" : selectedGate;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 overflow-x-auto">
            <RegistryChipTabs
              tabs={gateTabs}
              value={selectedGate}
              onValueChange={setSelectedGate}
              ariaLabel="Gate filter"
            />
          </div>

          {warningBuckets > 0 || stalledAdmission ? (
            <Badge
              variant="outline"
              className="shrink-0 border-destructive/25 bg-destructive/5 text-destructive">
              <AlertTriangle data-icon="inline-start" className="size-3" />
              Check gates
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-border/60 bg-muted/30 text-muted-foreground">
              Flow normal
            </Badge>
          )}
        </div>

        <ChartContainer
          config={chartConfig}
          initialDimension={{ width: 320, height: CHART_HEIGHT_PX }}
          className={cn(
            "mt-2 aspect-auto w-full",
            "[&_.recharts-cartesian-grid-horizontal_line]:stroke-border/30",
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-axis-tick_text]:text-[10px]",
            "[&_.recharts-legend-wrapper]:relative [&_.recharts-legend-wrapper]:z-0",
            "[&_.recharts-tooltip-wrapper]:z-50",
          )}
          style={{ height: CHART_HEIGHT_PX }}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={CHART_MARGIN}
            barCategoryGap="36%">
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              horizontalValues={yAxisTicks}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval="preserveStartEnd"
              minTickGap={48}
              tick={<GateFlowXAxisTick />}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, yAxisMax]}
              ticks={yAxisTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={0}
              width={Y_AXIS_WIDTH}
              tick={<GateFlowYAxisTick />}
            />
            <ChartTooltip
              wrapperStyle={{ zIndex: 50 }}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  className="min-w-40 gap-3 px-4 py-3 [&>div:last-child]:gap-2"
                  labelClassName="w-full font-normal"
                  indicator="dot"
                  formatter={(value, _name, item) => {
                    const dataKey = String(item.dataKey ?? "");
                    const seriesConfig =
                      chartConfig[dataKey as keyof typeof chartConfig];
                    const indicatorColor =
                      item.color ?? item.payload?.fill ?? "currentColor";

                    return (
                      <div className="flex w-full items-center gap-2.5">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: indicatorColor }}
                        />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-6">
                          <span className="text-muted-foreground">
                            {seriesConfig?.label ?? dataKey}
                          </span>
                          <span className="font-medium text-foreground">
                            {typeof value === "number"
                              ? value.toLocaleString()
                              : String(value)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                  labelFormatter={(_, payload) => {
                    const bucket = getTooltipBucket(payload);
                    if (!bucket) {
                      return null;
                    }

                    return (
                      <div className="flex flex-col gap-2 border-b border-border/50 pb-3">
                        <span className="font-medium text-foreground">
                          {bucket.label}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {selectedGateLabel} · {bucket.total} scans
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          Top denial: {bucket.topDenialReasonLabel}
                          {bucket.topDenialReasonCount > 0
                            ? ` (${bucket.topDenialReasonCount})`
                            : ""}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Legend
              align="left"
              verticalAlign="bottom"
              wrapperStyle={{
                zIndex: 0,
                paddingLeft: PLOT_LEFT_INSET,
                paddingRight: CHART_MARGIN.right,
              }}
              content={
                <ChartLegendContent className="w-full justify-start gap-3 pt-1.5 text-[10px] text-muted-foreground" />
              }
            />
            <Bar
              dataKey="granted"
              stackId="result"
              fill="var(--color-granted)"
              maxBarSize={28}
              radius={[0, 0, 2, 2]}
            />
            <Bar
              dataKey="denied"
              stackId="result"
              fill="var(--color-denied)"
              maxBarSize={28}
            />
            <Bar
              dataKey="timeoutOrError"
              stackId="result"
              fill="var(--color-timeoutOrError)"
              maxBarSize={28}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}
