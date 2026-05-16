"use client";

import * as React from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mockScanAction, getAssignedGatesAction, type Gate } from "@/app/(dashboard)/events/[eventId]/mock-scan-action";

interface Props {
  eventId: string;
  children: React.ReactElement;
  initialGates?: Gate[];
  stubMode?: boolean;
}

type Phase = "idle" | "loading_gates" | "submitting" | "success" | "error";

export function MockScanPopover({ eventId, children, initialGates, stubMode }: Props) {
  const [open, setOpen] = React.useState(false);
  const [gates, setGates] = React.useState<Gate[]>(initialGates || []);
  const [hasLoaded, setHasLoaded] = React.useState(initialGates !== undefined);
  const [selectedGateId, setSelectedGateId] = React.useState<string | null>(
    (initialGates && initialGates.length > 0) ? initialGates[0].gate_id : null
  );
  const [payload, setPayload] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [scanResult, setScanResult] = React.useState<{ result: "grant" | "deny"; ticket_id?: string; reason?: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isSubmitting = phase === "submitting";

  const loadGates = React.useCallback(async () => {
    // Only load if we haven't loaded yet or if we specifically want to refresh
    if (hasLoaded && phase !== "loading_gates") {
      // If we already have gates but no selection, select the first one
      if (!selectedGateId && gates.length > 0) {
        setSelectedGateId(gates[0].gate_id);
      }
      return;
    }

    setPhase("loading_gates");
    try {
      const data = await getAssignedGatesAction(eventId);
      setGates(data);
      setHasLoaded(true);
      if (data.length > 0 && !selectedGateId) {
        setSelectedGateId(data[0].gate_id);
      }
      setPhase("idle");
    } catch (e) {
      setError(`Failed to load gates: ${e}`);
      setPhase("error");
    }
  }, [eventId, hasLoaded, phase, selectedGateId, gates]);

  const resetForm = React.useCallback(() => {
    setPayload("");
    setScanResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) return;

    setOpen(nextOpen);

    if (nextOpen) {
      if (!hasLoaded) {
        loadGates();
      }
    } else {
      window.setTimeout(resetForm, 500);
    }
  }, [isSubmitting, loadGates, resetForm, hasLoaded]);

  const trimmed = payload.trim();
  const canSubmit = trimmed.length > 0 && selectedGateId !== null && !isSubmitting;

  async function onSubmit(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault();
    if (!canSubmit) return;

    setPhase("submitting");
    setError(null);
    setScanResult(null);

    if (!selectedGateId) return;
    const r = await mockScanAction(selectedGateId, payload, eventId, stubMode);

    if (r.ok) {
      setScanResult({
        result: r.result,
        ticket_id: r.ticket_id,
        reason: r.reason,
      });
      setPhase("success");
      return;
    }

    setError(r.error);
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
        className="w-80 p-0 overflow-hidden border-none shadow-2xl ring-1 ring-border flex flex-col bg-popover"
        align="end"
        sideOffset={12}
      >
        <div className="min-h-80 flex flex-col relative">
          {phase === "loading_gates" ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
              <p className="text-sm font-medium text-foreground">Loading gates...</p>
            </div>
          ) : phase === "submitting" ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 animate-in fade-in zoom-in-95 duration-300">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
              <p className="text-sm font-medium text-foreground">Verifying scan...</p>
            </div>
          ) : phase === "success" && scanResult ? (
            <div className="flex-1 flex flex-col items-center justify-center py-14 px-8 animate-in fade-in zoom-in-95 duration-300">
              <div className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center mb-6 shadow-sm",
                scanResult.result === "grant" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {scanResult.result === "grant" ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <XCircle className="h-8 w-8" />
                )}
              </div>
              <h3 className="text-base font-semibold text-foreground text-center tracking-tight">
                Scan {scanResult.result === "grant" ? "Granted" : "Denied"}
              </h3>
              {scanResult.result === "grant" ? (
                <div className="mt-3 bg-muted/40 px-3 py-1.5 rounded-md border border-border/50">
                  <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                    Ticket {scanResult.ticket_id?.slice(0, 8)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-rose-600/90 mt-2 text-center font-medium bg-rose-50/50 px-3 py-1 rounded-full border border-rose-100">
                  {scanResult.reason?.replace(/_/g, " ").toUpperCase() || "UNKNOWN REASON"}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-8 h-8 px-4 text-xs font-medium"
                onClick={() => setPhase("idle")}
              >
                Mock another
              </Button>
            </div>
          ) : (
            <div className="p-4 flex-1 flex flex-col animate-in fade-in duration-200">
              <PopoverHeader className="mb-4">
                <PopoverTitle className="flex items-center gap-2">
                  <Scan className="h-4 w-4 text-primary" />
                  Mock Gate Scan
                </PopoverTitle>
                <PopoverDescription>
                  Simulate a hardware scan at a specific gate.
                </PopoverDescription>
              </PopoverHeader>

              <form onSubmit={onSubmit} className="flex-1 flex flex-col space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-0.5">
                    Select Gate
                  </label>
                  <Select value={selectedGateId} onValueChange={(val) => setSelectedGateId(val)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={gates.length === 0 ? "No gates assigned" : "Select a gate"}>
                        {gates.find(g => g.gate_id === selectedGateId)?.location}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {gates.map((g) => (
                        <SelectItem key={g.gate_id} value={g.gate_id} className="py-2">
                          {g.location}
                        </SelectItem>
                      ))}
                      {gates.length === 0 && (
                        <div className="p-3 text-muted-foreground italic">
                          No gates assigned
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-h-30 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-0.5">
                    QR Payload (JSON)
                  </label>
                  <textarea
                    id="scan-qr"
                    placeholder='{"subject": "...", "data": "..."}'
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={5}
                    className={cn(
                      "w-full h-full min-h-30 resize-none rounded-lg border border-input/50 bg-muted/10 px-3 py-2.5",
                      "font-mono text-[11px] leading-relaxed",
                      "placeholder:text-muted-foreground/40",
                      "outline-none transition-all",
                      "focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/5",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    disabled={isSubmitting}
                  />
                </div>

                {phase === "error" && error && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 p-2.5 rounded-lg border border-destructive/10 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 mt-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:bg-muted/50 h-8 px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-8 px-4 font-medium"
                  >
                    Mock Scan
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