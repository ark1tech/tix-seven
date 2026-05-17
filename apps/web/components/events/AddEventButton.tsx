"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function AddEventButton() {
  return (
    <Link
      href="/events/new"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center px-3 text-xs font-medium",
        "bg-primary/8 text-primary",
        "hover:bg-primary/15 hover:text-primary transition-all duration-200 shadow-none gap-1.5 rounded-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted",
      )}>
      Create event
    </Link>
  );
}
