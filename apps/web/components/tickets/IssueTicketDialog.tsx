"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { issueTicketAction } from "@/app/(dashboard)/events/[eventId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Phase = "idle" | "submitting" | "success" | "error";

const errorMessages: Record<
  "identity_not_verified" | "event_not_found" | "already_issued" | "internal_server_error",
  string
> = {
  identity_not_verified:
    "The QR payload could not be verified. Check the JSON and try again.",
  event_not_found: "This event was not found. Refresh the page and try again.",
  already_issued:
    "A ticket for this identity on this event already exists.",
  internal_server_error:
    "Something went wrong on the server. Try again in a moment.",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

export function IssueTicketDialog({ open, onOpenChange, eventId }: Props) {
  const router = useRouter();
  const [payload, setPayload] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [errorCode, setErrorCode] = React.useState<
    keyof typeof errorMessages | null
  >(null);
  const [lastTicketId, setLastTicketId] = React.useState<string | null>(null);
  const isSubmitting = phase === "submitting";

  function resetForm() {
    setPayload("");
    setPhase("idle");
    setErrorCode(null);
    setLastTicketId(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  const trimmed = payload.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPhase("submitting");
    setErrorCode(null);
    setLastTicketId(null);

    const r = await issueTicketAction(eventId, payload);
    router.refresh();

    if (r.ok) {
      setLastTicketId(r.ticket.ticket_id);
      setPhase("success");
      window.setTimeout(() => {
        handleOpenChange(false);
      }, 2000);
      return;
    }

    setErrorCode(r.error);
    setPhase("error");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Issue ticket</DialogTitle>
          <DialogDescription>
            Paste the PhilSys National ID QR JSON. One ticket is issued per
            verified identity for this event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="philsys-qr" className="text-sm font-medium">
              Paste PhilSys QR JSON
            </label>
            <textarea
              id="philsys-qr"
              name="philsys-qr"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={6}
              autoComplete="off"
              className={cn(
                "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2",
                "font-mono text-xs leading-relaxed",
                "placeholder:text-muted-foreground",
                "outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={isSubmitting}
            />
          </div>

          {phase === "success" && lastTicketId && (
            <p className="text-sm text-muted-foreground">
              Ticket issued:{" "}
              <span className="font-mono text-foreground">
                {lastTicketId}
              </span>
            </p>
          )}

          {phase === "error" && errorCode && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessages[errorCode]}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
            >
              {phase === "submitting" ? "Issuing…" : "Issue ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
