"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Event } from "@tix-seven/types";
import IssueTicketDialog from "@/components/tickets/IssueTicketDialog";

interface Props {
  event: Event;
}

export default function EventHeader({ event }: Props) {
  const pathname = usePathname();
  const rootPath = `/events/${event.id}`;
  const isRoot = pathname === rootPath;
  const isEntryLog = pathname.endsWith("/entry-log");
  const isEdit = pathname.endsWith("/edit");

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(event.date));

  return (
    <div className="pb-5 border-b mb-8">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Link
          href="/events"
          className="hover:text-foreground transition-colors duration-150"
        >
          Events
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link
          href={`/events/${event.id}`}
          className={cn(
            "transition-colors duration-150",
            !isEntryLog && !isEdit ? "text-foreground cursor-default" : "hover:text-foreground"
          )}
        >
          {event.name}
        </Link>
        {isEntryLog && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Live Entry Log</span>
          </>
        )}
        {isEdit && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Edit</span>
          </>
        )}
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {event.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {event.venue} · {formattedDate}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isRoot && (
            <>
              <Link
                href={`/events/${event.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit
              </Link>
              <Link
                href={`/events/${event.id}/entry-log`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Live Entry Log
              </Link>
              <IssueTicketDialog eventId={event.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
