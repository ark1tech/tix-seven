"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { IssueTicketDialog } from "@/components/tickets/IssueTicketDialog";

interface Props {
  eventId: string;
}

export function IssueTicketButton({ eventId }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Issue ticket
      </Button>
      <IssueTicketDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
      />
    </>
  );
}
