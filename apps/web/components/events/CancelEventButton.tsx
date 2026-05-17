"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CancelEventDialog } from "@/components/events/CancelEventDialog";

interface Props {
  eventId: string;
  eventName: string;
}

export function CancelEventButton({ eventId, eventName }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleConfirm() {
    setCancelling(true);
    const res = await fetch(`/api/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setCancelling(false);

    if (res.ok) {
      setDialogOpen(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setDialogOpen(true)}
        disabled={cancelling}>
        Cancel Event
      </Button>

      <CancelEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventName={eventName}
        onConfirm={handleConfirm}
        isSubmitting={cancelling}
      />
    </>
  );
}
