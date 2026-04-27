import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatEventDateMediumPht,
  formatEventDayNumericPht,
  formatEventMonthShortPht,
} from "@/lib/datetime-pht";
import type { Event } from "@tix-seven/types";

export default function EventCard({ event }: { event: Event }) {
  const date = formatEventDateMediumPht(event.start_time);
  const month = formatEventMonthShortPht(event.start_time);
  const day = formatEventDayNumericPht(event.start_time);

  return (
    <Link href={`/events/${event.event_id}`}>
      <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold leading-snug">{event.name}</CardTitle>
            <span className="shrink-0 inline-flex flex-col items-center rounded-md bg-primary/10 px-2 py-1 text-primary leading-none">
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
              <span>Capacity</span>
              <span className="font-medium text-foreground">
                {event.capacity.toLocaleString("en-PH")}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-1 rounded-full bg-primary" style={{ width: "0%" }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
