"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Ticket,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventSummary } from "@tix-seven/types";

type Props = {
  events: EventSummary[];
};

function isEventPath(pathname: string, eventId: string): boolean {
  return (
    pathname === `/events/${eventId}` ||
    pathname.startsWith(`/events/${eventId}/`)
  );
}

export default function SidebarNav({ events }: Props) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const eventsActive =
    pathname === "/events" || pathname.startsWith("/events/");
  const showEventSubmenu = !isCollapsed;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col rounded-xl bg-sidebar shadow-sm transition-all duration-300 ease-in-out px-4 py-4 overflow-hidden outline-none border-0",
        isCollapsed ? "w-[72px]" : "w-56",
      )}>
      {/* Top Header */}
      <div className="flex items-center shrink-0 mb-6 h-10 relative w-full">
        <div
          className={cn(
            "flex items-center gap-2 overflow-hidden transition-all duration-300 absolute left-0 h-10",
            isCollapsed ? "w-0 opacity-0" : "w-[150px] opacity-100",
          )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ml-1">
            <Ticket className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
            TixSeven
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 h-10 w-10 text-muted-foreground hover:bg-muted/80 hover:text-foreground shrink-0 transition-transform duration-300"
          onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Events */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <Link
            href="/events"
            className={cn(
              "flex items-center rounded-md px-3 h-10 text-sm font-medium transition-colors duration-150 overflow-hidden shrink-0",
              eventsActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isCollapsed ? "w-10 gap-0" : "w-full gap-3",
            )}
            title={isCollapsed ? "Events" : undefined}>
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap overflow-hidden transition-all duration-300",
                isCollapsed ? "w-0 opacity-0" : "w-[120px] opacity-100",
              )}>
              Events
            </span>
          </Link>

          {showEventSubmenu && (
            <ul
              className="flex flex-col gap-0.5 border-l border-sidebar-border ml-5 pl-2 mr-1"
              aria-label="Events">
              {events.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">
                  No events yet
                </li>
              ) : (
                events.map((event) => {
                  const subActive = isEventPath(pathname, event.event_id);
                  return (
                    <li key={event.event_id}>
                      <Link
                        href={`/events/${event.event_id}`}
                        className={cn(
                          "flex items-center rounded-md px-2 h-8 text-xs font-medium transition-colors duration-150 min-w-0",
                          subActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        title={event.name}>
                        <span className="truncate">{event.name}</span>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto shrink-0">
        <form action="/api/auth/signout" method="post">
          <Button
            variant="ghost"
            className={cn(
              "text-muted-foreground hover:text-foreground transition-all duration-300 overflow-hidden text-sm font-medium h-10 shrink-0 flex items-center justify-start px-3",
              isCollapsed ? "w-10 gap-0" : "w-full gap-3",
            )}
            type="submit"
            title={isCollapsed ? "Sign out" : undefined}>
            <LogOut className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap overflow-hidden transition-all duration-300",
                isCollapsed ? "w-0 opacity-0" : "w-[120px] opacity-100",
              )}>
              Sign out
            </span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
