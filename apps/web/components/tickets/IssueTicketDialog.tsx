"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CameraAdapter } from "@/lib/qr-scanner/camera-adapter";
import type { QRScanner } from "@/lib/qr-scanner/types";
import type { TicketTier } from "@tix-seven/types";

// To swap to a GM861S scanner, replace CameraAdapter with your HID/Serial adapter here.
// Both implement the same QRScanner interface — no other changes needed.
function createScanner(): QRScanner {
  return new CameraAdapter();
}

interface Props {
  eventId: string;
}

type Step = "scan" | "confirm" | "payment";

export default function IssueTicketDialog({ eventId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("scan");
  const [tier, setTier] = useState<TicketTier>("ga");
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<QRScanner | null>(null);

  useEffect(() => {
    if (!open) {
      scannerRef.current?.stop();
      scannerRef.current = null;
      setStep("scan");
      setIsScanning(false);
      setScannedPayload(null);
      setError(null);
    }
  }, [open]);

  function startScanner() {
    setIsScanning(true);
    const scanner = createScanner();
    scannerRef.current = scanner;
    scanner.start((payload) => {
      scannerRef.current?.stop();
      setIsScanning(false);
      setScannedPayload(payload);
      setStep("confirm");
    });
  }

  async function handleIssue() {
    if (!scannedPayload) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, qrPayload: scannedPayload, tier }),
    });

    if (!res.ok) {
      const body = await res.json();
      const errMsg = typeof body.error === "string" ? body.error : (body.error?.formErrors?.[0] || body.error?.message || "Failed to issue ticket");
      setError(errMsg);
      setLoading(false);
      return;
    }

    setStep("payment");
    setLoading(false);
  }

  function handleClose() {
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Issue Ticket</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Ticket</DialogTitle>
        </DialogHeader>

        {step === "scan" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Present the attendee&apos;s PhilSys National ID to the camera.
            </p>
            <video
              id="qr-scanner-video"
              className="w-full rounded-md aspect-video bg-muted"
              muted
            />
            {!isScanning && (
              <Button variant="secondary" onClick={startScanner}>
                Start Scanner
              </Button>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-tier-select">Ticket Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as TicketTier)}>
                <SelectTrigger id="ticket-tier-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ga">General Admission</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              PhilSys QR scanned. Verify the details below before issuing.
            </p>
            <div className="rounded-md border p-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier</span>
                <Badge variant={tier === "vip" ? "default" : "secondary"}>
                  {tier.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">QR payload length</span>
                <span className="font-mono">{scannedPayload?.length} chars</span>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setStep("scan"); setIsScanning(false); }}>
                Rescan
              </Button>
              <Button onClick={handleIssue} disabled={loading}>
                {loading ? "Verifying…" : "Confirm & Issue"}
              </Button>
            </div>
          </div>
        )}

        {step === "payment" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-green-500/30 bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              Ticket issued successfully. Payment confirmed (mock).
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
