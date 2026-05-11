"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Camera, ScanLine } from "lucide-react";

import { issueTicketAction } from "@/app/(dashboard)/events/[eventId]/actions";
import { Button } from "@/components/ui/button";
import type { IssueError } from "@/lib/gate-server/client";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

type Phase = "scanning" | "submitting" | "success" | "error";

const errorMessages: Record<IssueError, string> = {
  unauthorized:
    "Your session is missing or no longer valid. Sign in, then try again.",
  forbidden: "You do not have permission to issue tickets for this event.",
  mosip_unavailable:
    "Identity checking is temporarily unavailable. Try again in a few minutes.",
  identity_not_verified: "The QR is invalid. Please try again.",
  event_not_found: "This event was not found. Refresh the page and try again.",
  ticket_already_issued: "A ticket for this identity already exists for this event.",
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
  const [phase, setPhase] = React.useState<Phase>("scanning");
  const [payload, setPayload] = React.useState("");
  const [errorCode, setErrorCode] = React.useState<IssueError | null>(null);
  const [lastTicketId, setLastTicketId] = React.useState<string | null>(null);
  const scannerRef = React.useRef<import("@/lib/qr-scanner/camera-adapter").CameraAdapter | null>(null);
  const resetTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmitting = phase === "submitting";

  const stopScanner = React.useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current = null;
  }, []);

  const resetForm = React.useCallback(() => {
    stopScanner();
    setPayload("");
    setPhase("scanning");
    setErrorCode(null);
    setLastTicketId(null);
  }, [stopScanner]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isSubmitting) return;

      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }

      if (nextOpen) {
        resetForm();
      }

      setOpen(nextOpen);
    },
    [isSubmitting, resetForm]
  );

  React.useEffect(() => {
    let active = true;

    if (open && phase === "scanning") {
      import("@/lib/qr-scanner/camera-adapter").then(({ CameraAdapter }) => {
        if (!active) return;
        
        stopScanner();
        const adapter = new CameraAdapter();
        scannerRef.current = adapter;
        
        adapter.start((decoded) => {
          if (active) {
            stopScanner();
            onConfirm(false, decoded);
          }
        }).catch(() => {});
      });
    }

    return () => {
      active = false;
      stopScanner();
    };
  }, [open, phase, stopScanner]);

  async function onConfirm(stub: boolean = false, payloadOverride?: string) {
    const nextPayload = (payloadOverride ?? payload).trim();
    if (!nextPayload || isSubmitting) return;

    setPhase("submitting");
    setErrorCode(null);
    setLastTicketId(null);
    setPayload(nextPayload);

    const r = await issueTicketAction(eventId, nextPayload, stub);

    if (r.ok) {
      setLastTicketId(r.ticket.ticket_id);
      setPhase("success");
      router.refresh();
      window.setTimeout(() => handleOpenChange(false), 2000);
      return;
    }

    setErrorCode(r.error);
    setPhase("error");
  }

  function onRescan() {
    setPayload("");
    setErrorCode(null);
    // Add a small delay to ensure the scanner is fully reset and doesn't immediately 
    // pick up the same QR code frame.
    setTimeout(() => {
      setPhase("scanning");
    }, 150);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={children}
        onClick={() => handleOpenChange(true)}
      />

      <DialogPortal>
        <DialogOverlay className="bg-black/60 duration-200" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-2xl",
            "p-0 overflow-hidden flex flex-col max-h-[90vh]",
            "duration-200 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          <div className="min-h-[440px] flex flex-col">
            {phase === "scanning" && (
              <div className="flex-1 flex flex-col animate-in fade-in duration-200">
                <div className="px-6 pt-6 pb-4">
                  <DialogHeader>
                    <DialogTitle>Issue Ticket</DialogTitle>
                    <DialogDescription>
                      Scan the PhilSys National ID QR code with your camera.
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="px-6 flex-1 flex flex-col justify-center">
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-square shadow-inner">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      id="qr-scanner-video"
                      className="w-full h-full object-cover transform scale-x-[-1]"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-[80%] h-[80%]">
                        <span className="absolute top-0 left-0 w-10 h-10 border-t-[2px] border-l-[2px] border-white/90 rounded-tl-lg" />
                        <span className="absolute top-0 right-0 w-10 h-10 border-t-[2px] border-r-[2px] border-white/90 rounded-tr-lg" />
                        <span className="absolute bottom-0 left-0 w-10 h-10 border-b-[2px] border-l-[2px] border-white/90 rounded-bl-lg" />
                        <span className="absolute bottom-0 right-0 w-10 h-10 border-b-[2px] border-r-[2px] border-white/90 rounded-br-lg" />
                        <ScanLine className="absolute inset-0 m-auto h-10 w-10 text-white/50 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-4">
                    <Camera className="h-3 w-3" />
                    <span>Waiting for QR code…</span>
                  </div>
                </div>

                <div className="flex justify-end px-6 py-4 mt-6 border-t bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                    className="text-muted-foreground hover:bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {phase === "submitting" && (
              <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 animate-in fade-in zoom-in-95 duration-300">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
                <p className="text-sm font-medium text-foreground">Issuing ticket…</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Verifying identity with Philsys National ID
                </p>
              </div>
            )}

            {phase === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-foreground text-center">
                  Ticket issued successfully!
                </p>
                {lastTicketId && (
                  <p className="text-sm font-mono text-muted-foreground mt-2 bg-muted/50 px-2 py-1 rounded">
                    ID: {lastTicketId.slice(0, 8)}…
                  </p>
                )}
              </div>
            )}

            {phase === "error" && (
              <div className="flex-1 flex flex-col animate-in fade-in duration-200">
                <div className="px-6 pt-6 pb-4">
                  <DialogHeader>
                    <DialogTitle>Issue Ticket</DialogTitle>
                    <DialogDescription>
                      An error occurred while issuing the ticket.
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="px-6 flex-1 flex flex-col">
                  {errorCode && (
                    <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 p-2.5 rounded-lg border border-destructive/10 animate-in fade-in slide-in-from-top-1 duration-200 mt-3">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <p>{messageForIssueError(errorCode)}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 mt-6 border-t bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRescan}
                    className="text-muted-foreground hover:bg-transparent"
                  >
                    Rescan
                  </Button>
                  <Button type="button" size="sm" onClick={() => onConfirm(defaultStub)} className="shadow-xs">
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
