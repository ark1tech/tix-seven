"use client";

import { Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockScanPopover } from "@/components/tickets/MockScanPopover";
import type { Gate } from "@/app/(dashboard)/events/[eventId]/mock-scan-action";

interface Props {
  eventId: string;
  initialGates?: Gate[];
}

export function MockScanButton({ eventId, initialGates }: Props) {
  if (process.env.NEXT_PUBLIC_DEBUG_TOOLS !== "true") {
    return null;
  }

  return (
    <MockScanPopover eventId={eventId} initialGates={initialGates}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-xs font-medium bg-primary/[0.08] text-primary border border-primary/10 hover:bg-primary/15 hover:text-primary transition-all duration-200 shadow-none gap-1.5 rounded-md focus-visible:ring-0 aria-expanded:bg-primary/20 aria-expanded:text-primary aria-expanded:border-primary/30 aria-expanded:shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer"
      >
        Mock scan
      </Button>
    </MockScanPopover>
  );
}
