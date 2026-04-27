"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { issueTicketAction } from "@/app/(dashboard)/events/[eventId]/actions";
import { Button } from "@/components/ui/button";
import type { IssueError } from "@/lib/gate-server/client";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Phase = "idle" | "submitting" | "success" | "error";

const errorMessages: Record<IssueError, string> = {
  unauthorized:
    "Your session is missing or no longer valid. Sign in, then try again.",
  forbidden: "You do not have permission to issue tickets for this event.",
  mosip_unavailable:
    "Identity checking is temporarily unavailable. Try again in a few minutes.",
  identity_not_verified: "The QR is invalid. Please try again.",
  event_not_found: "This event was not found. Refresh the page and try again.",
  already_issued: "A ticket for this identity already exists for this event.",
  internal_server_error:
    "Something went wrong on the server. Try again in a moment.",
};

function messageForIssueError(code: IssueError): string {
  return errorMessages[code] ?? errorMessages.internal_server_error;
}

interface Props {
  eventId: string;
  children: React.ReactElement;
}

export function IssueTicketPopover({ eventId, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [errorCode, setErrorCode] = React.useState<IssueError | null>(null);
  const [lastTicketId, setLastTicketId] = React.useState<string | null>(null);
  const isSubmitting = phase === "submitting";

  const resetForm = React.useCallback(() => {
    setPayload("");
    setPhase("idle");
    setErrorCode(null);
    setLastTicketId(null);
  }, []);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) return;
    
    setOpen(nextOpen);
    
    // Delay reset to avoid layout shift and state flickering during exit animation
    if (!nextOpen) {
      window.setTimeout(resetForm, 500);
    }
  }, [isSubmitting, resetForm]);

  const trimmed = payload.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  async function onSubmit(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    
    setPhase("submitting");
    setErrorCode(null);
    setLastTicketId(null);

    const r = await issueTicketAction(eventId, payload);
    
    if (r.ok) {
      setLastTicketId(r.ticket.ticket_id);
      setPhase("success");
      router.refresh();
      window.setTimeout(() => {
        handleOpenChange(false);
      }, 2000);
      return;
    }

    setErrorCode(r.error);
    setPhase("error");
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={children} />
      <PopoverContent 
        className="w-80 p-0 overflow-hidden border-none shadow-xl ring-1 ring-black/5 flex flex-col" 
        align="end" 
        sideOffset={8}
      >
        <div className="min-h-[290px] flex flex-col relative">
          {phase === "submitting" ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 animate-in fade-in zoom-in-95 duration-300">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
              <p className="text-sm font-medium text-foreground">Issuing ticket...</p>
              <p className="text-xs text-muted-foreground mt-1 text-center">Verifying identity with Philsys National ID</p>
            </div>
          ) : phase === "success" ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-foreground text-center">Ticket issued successfully!</p>
              {lastTicketId && (
                <p className="text-[10px] font-mono text-muted-foreground mt-2 bg-muted/50 px-2 py-1 rounded">
                  ID: {lastTicketId.slice(0, 8)}…
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 flex-1 flex flex-col animate-in fade-in duration-200">
              <PopoverHeader className="mb-4">
                <PopoverTitle>Issue Ticket</PopoverTitle>
                <PopoverDescription>
                  Paste the PhilSys National ID QR JSON to issue a verified ticket.
                </PopoverDescription>
              </PopoverHeader>

              <form onSubmit={onSubmit} className="flex-1 flex flex-col space-y-4">
                <div className="flex-1 min-h-[120px]">
                  <textarea
                    id="philsys-qr"
                    name="philsys-qr"
                    placeholder='{"subject": "...", "data": "..."}'
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={5}
                    autoComplete="off"
                    autoFocus
                    className={cn(
                      "w-full h-full min-h-[120px] resize-none rounded-lg border border-input/50 bg-muted/20 px-3 py-2",
                      "font-mono text-[11px] leading-relaxed",
                      "placeholder:text-muted-foreground/50",
                      "outline-none transition-all",
                      "focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/5",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    disabled={isSubmitting}
                  />
                </div>

                {phase === "error" && errorCode && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 p-2.5 rounded-lg border border-destructive/10 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>{messageForIssueError(errorCode)}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1 mt-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!canSubmit} className="shadow-xs">
                    Issue Ticket
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
