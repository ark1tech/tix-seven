"use client";

import { Download } from "lucide-react";

import { ExportPopover } from "@/components/events/ExportPopover";
import { Button } from "@/components/ui/button";

type ExportMode = "registry" | "logs";

interface Props {
  eventId: string;
  mode: ExportMode;
}

export function ExportButton({ eventId, mode }: Props) {
  return (
    <ExportPopover eventId={eventId} mode={mode}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8">
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>
    </ExportPopover>
  );
}
