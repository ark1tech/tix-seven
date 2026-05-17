"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ExportButton } from "@/components/events/ExportButton";
import { useEventHeaderActions } from "@/components/events/event-header-actions";
import { IssueTicketButton } from "@/components/tickets/IssueTicketButton";
import { MockScanButton } from "@/components/tickets/MockScanButton";
import { formatEventDateMediumPht } from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import type { EventDetail, EventStatus } from "@tix-seven/types";

const STATUS_BADGE: Record<EventStatus, { label: string; className: string }> =
  {
    SCHEDULED: {
      label: "Scheduled",
      className: "bg-sky-50 text-sky-700 border-sky-200",
    },
    ACTIVE: {
      label: "Active",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    CONCLUDED: {
      label: "Concluded",
      className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-red-50 text-red-600 border-red-200",
    },
  };

interface Props {
  event: EventDetail;
}

export default function EventHeader({ event }: Props) {
  const pathname = usePathname();
  const rootPath = `/events/${event.event_id}`;

  const isRoot = pathname === rootPath;
  const isEdit = pathname.endsWith("/edit");
  const isTickets = pathname.endsWith("/tickets");
  const isEntryLog = pathname.endsWith("/entry-log");

  // Any sub-page that isn't the event root itself
  const isSubPage = isEdit || isTickets || isEntryLog;

  const isMutable = event.status === "SCHEDULED" || event.status === "ACTIVE";
  const { label: statusLabel, className: statusClass } =
    STATUS_BADGE[event.status];
  const formattedDate = formatEventDateMediumPht(event.start_time);

  const pageActions = useEventHeaderActions();

  return (
    <div className="border-b pb-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Link
          href="/events"
          className="hover:text-foreground transition-colors duration-150">
          Events
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link
          href={rootPath}
          className={cn(
            "transition-colors duration-150",
            !isSubPage
              ? "text-foreground cursor-default"
              : "hover:text-foreground",
          )}>
          {event.name}
        </Link>
        {isEdit && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Edit</span>
          </>
        )}
        {isTickets && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Tickets</span>
          </>
        )}
        {isEntryLog && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Live Entry Log</span>
          </>
        )}
      </nav>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
                statusClass,
              )}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {event.venue_name} · {formattedDate}
          </p>
        </div>

        <div className="flex flex-row items-center gap-2 shrink-0 flex-wrap justify-end">
          {isRoot && (
            <>
              {isMutable && (
                <Link
                  href={`/events/${event.event_id}/edit`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}>
                  Edit
                </Link>
              )}

              <Link
                href={`/events/${event.event_id}/entry-log`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}>
                Live Entry Log
              </Link>

              {isMutable && <IssueTicketButton eventId={event.event_id} />}

              <div className="ml-2">
                <ExportButton
                  eventId={event.event_id}
                  mode={isEntryLog ? "logs" : "registry"}
                />
              </div>

              {isMutable && process.env.NEXT_PUBLIC_DEBUG_TOOLS === "true" && (
                <MockScanButton eventId={event.event_id} />
              )}
            </>
          )}

          {isEntryLog && (
            <div>
              <ExportButton
                eventId={event.event_id}
                mode={isEntryLog ? "logs" : "registry"}
              />
            </div>
          )}
        </div>

        {isEdit && pageActions && (
          <div className="flex flex-row items-center gap-2 shrink-0 flex-wrap justify-end">
            {pageActions}
          </div>
        )}
      </div>
    </div>
  );
}
