"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function RegisterGateDialog({
  eventId,
  venueId,
  disabled,
}: {
  eventId: string;
  venueId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/gates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venue_id: venueId,
        location: location.trim(),
        event_id: eventId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg =
        typeof body.error === "string" ? body.error : "Failed to register gate";
      setError(errMsg);
      setLoading(false);
      return;
    }

    setLocation("");
    setOpen(false);
    setLoading(false);
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 px-3 text-xs font-medium bg-primary/8 text-primary border border-primary/10",
              "hover:bg-primary/15 hover:text-primary transition-all duration-200 shadow-none gap-1.5 rounded-md",
              "focus-visible:ring-0 disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          />
        }>
        Register gate
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register Gate</DialogTitle>
            <DialogDescription>
              Add a new access point and assign it to this event.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="register-gate-location">Location</Label>
            <Input
              id="register-gate-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Entrance"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Registering…" : "Register Gate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
