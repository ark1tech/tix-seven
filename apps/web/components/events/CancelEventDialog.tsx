"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function CancelEventDialog({
  open,
  onOpenChange,
  eventName,
  onConfirm,
  isSubmitting,
}: Props) {
  const [confirmation, setConfirmation] = useState("");

  const nameMatches = confirmation === eventName;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    if (!nextOpen) {
      setConfirmation("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 duration-200" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-2xl",
            "p-0 overflow-hidden flex flex-col",
            "duration-200 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}>
          <div className="flex flex-col animate-in fade-in duration-200">
            <div className="px-6 pt-6 pb-4 space-y-4">
              <DialogHeader>
                <DialogTitle>Cancel this event?</DialogTitle>
                <DialogDescription>
                  This will mark the event as cancelled. Ticket holders and gate
                  assignments will no longer be active for entry. This cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <Label htmlFor="cancel-event-confirmation" className="text-sm">
                  Type{" "}
                  <span className="font-medium text-foreground font-mono bg-[#f3f3f3] px-2 py-0.5 rounded-xl">
                    {eventName}
                  </span>{" "}
                  to confirm
                </Label>
                <Input
                  id="cancel-event-confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={eventName}
                  disabled={isSubmitting}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-muted-foreground hover:bg-transparent">
                Keep event
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onConfirm}
                disabled={!nameMatches || isSubmitting}
                className="shadow-xs">
                {isSubmitting ? "Cancelling…" : "Cancel event"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
