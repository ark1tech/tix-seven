"use client";

import { Button } from "@/components/ui/button";
import { MockScanPopover } from "@/components/tickets/MockScanPopover";
import type { Gate } from "@/app/(dashboard)/events/[eventId]/mock-scan-action";

interface Props {
  eventId: string;
  initialGates?: Gate[];
  disabled?: boolean;
  stubMode?: boolean;
}

export function MockScanButton({ eventId, initialGates, disabled, stubMode }: Props) {
  if (process.env.NEXT_PUBLIC_DEBUG_TOOLS !== "true") {
    return null;
  }

  return (
    <MockScanPopover eventId={eventId} initialGates={initialGates} stubMode={stubMode}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="h-8 px-3 text-xs font-medium bg-primary/8 text-primary border border-primary/10 hover:bg-primary/15 hover:text-primary transition-all duration-200 shadow-none gap-1.5 rounded-md focus-visible:ring-0 aria-expanded:bg-primary/20 aria-expanded:text-primary aria-expanded:border-primary/30 aria-expanded:shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/8"
      >
        Mock scan
      </Button>
    </MockScanPopover>
  );
}