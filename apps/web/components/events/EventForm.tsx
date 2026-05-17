"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiscardUnsavedChangesDialog } from "@/components/events/DiscardUnsavedChangesDialog";
import {
  buildEmptyEventFormSnapshot,
  buildEventFormSnapshotFromEvent,
  eventFormSnapshotToPatchPayload,
  eventFormSnapshotToPayload,
  eventFormSnapshotsEqual,
  validateEventFormFields,
  type EventFormSnapshot,
} from "@/lib/events/event-form-snapshot";
import type { EventSummary, Venue } from "@tix-seven/types";

type SubmitPhase = "idle" | "submitting" | "success" | "error";

interface Props {
  venues: Venue[];
  event?: EventSummary;
}

function readErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;

    if (typeof err === "string" && err.trim()) {
      return err;
    }
  }

  return `Could not save the event (HTTP ${status}). Please try again.`;
}

export default function EventForm({ venues, event }: Props) {
  const router = useRouter();
  const isEditing = !!event;

  const loadedBaseline = useMemo(
    () =>
      event
        ? buildEventFormSnapshotFromEvent(event)
        : buildEmptyEventFormSnapshot(venues),
    [event, venues],
  );

  const [baselineOverride, setBaselineOverride] =
    useState<EventFormSnapshot | null>(null);
  const baseline = baselineOverride ?? loadedBaseline;

  const [name, setName] = useState(loadedBaseline.name);
  const [startTime, setStartTime] = useState(loadedBaseline.startTime);
  const [endTime, setEndTime] = useState(loadedBaseline.endTime);
  const [venueId, setVenueId] = useState(loadedBaseline.venueId);
  const [capacity, setCapacity] = useState(loadedBaseline.capacity);

  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const currentSnapshot: EventFormSnapshot = useMemo(
    () => ({ name, startTime, endTime, venueId, capacity }),
    [name, startTime, endTime, venueId, capacity],
  );

  const isDirty = !eventFormSnapshotsEqual(currentSnapshot, baseline);
  const isSubmitting = phase === "submitting";

  const selectedVenueName = useMemo(() => {
    const fromList = venues.find((v) => v.venue_id === venueId)?.name;
    if (fromList) return fromList;
    if (event?.venue_id === venueId && event.venue_name)
      return event.venue_name;
    return undefined;
  }, [venues, venueId, event]);

  const clearSuccessTimeout = useCallback(() => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearSuccessTimeout, [clearSuccessTimeout]);

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    const onDocumentClick = (e: MouseEvent) => {
      if (discardOpen) return;

      const target = e.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) {
        return;
      }

      const path = href.startsWith("http")
        ? new URL(href).pathname
        : href.split("?")[0] ?? href;

      if (path === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();

      pendingHrefRef.current = href.startsWith("http")
        ? new URL(href).pathname + new URL(href).search
        : href;
      setDiscardOpen(true);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [isDirty, isSubmitting, discardOpen]);

  function handleDiscardConfirm() {
    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    setDiscardOpen(false);

    if (!href) return;

    startTransition(() => {
      router.push(href);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearSuccessTimeout();

    const validationError = validateEventFormFields(currentSnapshot);
    if (validationError) {
      setErrorMessage(validationError);
      setPhase("error");
      return;
    }

    setPhase("submitting");
    setErrorMessage(null);

    const payload = isEditing
      ? eventFormSnapshotToPatchPayload(currentSnapshot, baseline)
      : eventFormSnapshotToPayload(currentSnapshot);

    if (isEditing && Object.keys(payload).length === 0) {
      setErrorMessage("No changes to save.");
      setPhase("error");
      return;
    }

    const url = isEditing ? `/api/events/${event.event_id}` : "/api/events";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(readErrorMessage(body, res.status));
        setPhase("error");
        return;
      }

      const saved = body as EventSummary;

      if (isEditing) {
        const savedSnapshot = buildEventFormSnapshotFromEvent(saved);
        setBaselineOverride(savedSnapshot);
        setPhase("success");

        startTransition(() => {
          router.refresh();
        });

        successTimeoutRef.current = window.setTimeout(() => {
          setPhase("idle");
        }, 1200);
        return;
      }

      setPhase("success");

      successTimeoutRef.current = window.setTimeout(() => {
        startTransition(() => {
          router.push(`/events/${saved.event_id}`);
          router.refresh();
        });
      }, 1200);
    } catch {
      setErrorMessage(
        "We couldn't reach the server. Check your internet connection and try again.",
      );
      setPhase("error");
    }
  }

  const submitDisabled =
    isSubmitting || phase === "success" || (isEditing && !isDirty);

  const submitLabel =
    phase === "submitting"
      ? "Saving…"
      : phase === "success"
        ? "Saved"
        : isEditing
          ? "Save Changes"
          : "Create Event";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Event Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            required
            disabled={isSubmitting || phase === "success"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="venue">Venue</Label>
          <Select
            value={venueId}
            onValueChange={(v) => {
              if (v) setVenueId(v);
              if (phase === "error") setPhase("idle");
            }}
            required
            disabled={isSubmitting || phase === "success"}>
            <SelectTrigger id="venue" className="w-full">
              <SelectValue placeholder="Select a venue">
                {selectedVenueName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {venues.map((venue) => (
                <SelectItem key={venue.venue_id} value={venue.venue_id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start-time">Start Date & Time</Label>
          <Input
            id="start-time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            required
            disabled={isSubmitting || phase === "success"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end-time">End Date & Time</Label>
          <Input
            id="end-time"
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            required
            disabled={isSubmitting || phase === "success"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => {
              setCapacity(e.target.value);
              if (phase === "error") setPhase("idle");
            }}
            required
            disabled={isSubmitting || phase === "success"}
          />
        </div>

        {phase === "success" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-lg px-3 py-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <p>
              {isEditing
                ? "Event saved successfully."
                : "Event created successfully. Redirecting…"}
            </p>
          </div>
        )}

        {phase === "error" && errorMessage && (
          <div
            className="flex items-start gap-2.5 text-sm leading-snug text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10 animate-in fade-in slide-in-from-top-1 duration-200"
            role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="min-w-0">{errorMessage}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {isDirty && phase === "idle" && (
            <p className="text-xs font-medium text-amber-700">
              Unsaved changes
            </p>
          )}

          <Button type="submit" disabled={submitDisabled}>
            {phase === "submitting" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>

      <DiscardUnsavedChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={handleDiscardConfirm}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
