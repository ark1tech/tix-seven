"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatEventDateMediumPht,
  formatEventDayNumericPht,
  formatEventMonthShortPht,
} from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import type { EventSummary, EventStatus } from "@tix-seven/types";

const STATUS_STYLES: Record<EventStatus, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-sky-50 text-sky-700 border-sky-200" },
  ACTIVE:    { label: "Active",    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CONCLUDED: { label: "Concluded", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

export default function EventCard({ event }: { event: EventSummary }) {
  const month = formatEventMonthShortPht(event.start_time);
  const day = formatEventDayNumericPht(event.start_time);
  const date = formatEventDateMediumPht(event.start_time);

  const { label: statusLabel, className: statusClass } = STATUS_STYLES[event.status];
  const admittedPct = event.capacity > 0
    ? Math.min(100, (event.admitted_count / event.capacity) * 100)
    : 0;

  return (
    <Link href={`/events/${event.event_id}`}>
      <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2">
            <div className="min-w-0 flex flex-col gap-1 items-start">
              <CardTitle className="w-full text-base font-semibold leading-snug">
                {event.name}
              </CardTitle>
              <span
                className={cn(
                  "w-fit shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide",
                  statusClass,
                )}
              >
                {statusLabel}
              </span>
            </div>
            <span className="shrink-0 self-start inline-flex flex-col items-center rounded-md bg-primary/10 px-2 py-1 text-primary leading-none">
              <span className="text-[10px] font-medium uppercase tracking-wide">{month}</span>
              <span className="text-sm font-bold">{day}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 flex-1 justify-between">
          <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
            <span>{event.venue_name}</span>
            <time className="text-xs" dateTime={event.start_time.replace(" ", "T")}>
              {date}
            </time>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Admitted</span>
              <span className="font-medium text-foreground">
                {event.admitted_count.toLocaleString("en-PH")}
                {" / "}
                {event.capacity.toLocaleString("en-PH")}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-1 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${admittedPct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}