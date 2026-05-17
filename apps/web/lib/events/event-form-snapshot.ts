import {
  datetimeLocalInputToPhtSqlTimestamp,
  eventTimestampToDatetimeLocalValue,
} from "@/lib/datetime-pht";
import type { EventDetail, EventSummary, Venue } from "@tix-seven/types";

export type EventFormSnapshot = {
  name: string;
  startTime: string;
  endTime: string;
  venueId: string;
  capacity: string;
};

export function buildEventFormSnapshotFromEvent(
  event: EventSummary | EventDetail,
): EventFormSnapshot {
  return {
    name: event.name,
    startTime: eventTimestampToDatetimeLocalValue(event.start_time),
    endTime: eventTimestampToDatetimeLocalValue(event.end_time),
    venueId: event.venue_id,
    capacity: event.capacity.toString(),
  };
}

export function buildEmptyEventFormSnapshot(
  venues: Venue[],
): EventFormSnapshot {
  return {
    name: "",
    startTime: "",
    endTime: "",
    venueId: venues[0]?.venue_id ?? "",
    capacity: "",
  };
}

export function eventFormSnapshotsEqual(
  a: EventFormSnapshot,
  b: EventFormSnapshot,
): boolean {
  return (
    a.name === b.name &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.venueId === b.venueId &&
    a.capacity === b.capacity
  );
}

export function validateEventFormFields(
  snapshot: EventFormSnapshot,
): string | null {
  if (!snapshot.name.trim()) {
    return "Event name is required.";
  }

  if (!snapshot.venueId) {
    return "Select a venue.";
  }

  if (!snapshot.startTime) {
    return "Start date and time are required.";
  }

  if (!snapshot.endTime) {
    return "End date and time are required.";
  }

  const startSql = datetimeLocalInputToPhtSqlTimestamp(snapshot.startTime);
  const endSql = datetimeLocalInputToPhtSqlTimestamp(snapshot.endTime);

  if (endSql <= startSql) {
    return "End date and time must be after the start date and time.";
  }

  const capacity = parseInt(snapshot.capacity, 10);

  if (Number.isNaN(capacity) || capacity < 1) {
    return "Capacity must be a whole number of at least 1.";
  }

  return null;
}

export function eventFormSnapshotToPayload(snapshot: EventFormSnapshot) {
  return {
    name: snapshot.name.trim(),
    start_time: datetimeLocalInputToPhtSqlTimestamp(snapshot.startTime),
    end_time: datetimeLocalInputToPhtSqlTimestamp(snapshot.endTime),
    venue_id: snapshot.venueId,
    capacity: parseInt(snapshot.capacity, 10),
  };
}

/** PATCH body with only fields that differ from the loaded baseline. */
export function eventFormSnapshotToPatchPayload(
  current: EventFormSnapshot,
  baseline: EventFormSnapshot,
): Record<string, string | number> {
  const patch: Record<string, string | number> = {};

  if (current.name.trim() !== baseline.name) {
    patch.name = current.name.trim();
  }

  if (current.venueId !== baseline.venueId) {
    patch.venue_id = current.venueId;
  }

  if (current.startTime !== baseline.startTime) {
    patch.start_time = datetimeLocalInputToPhtSqlTimestamp(current.startTime);
  }

  if (current.endTime !== baseline.endTime) {
    patch.end_time = datetimeLocalInputToPhtSqlTimestamp(current.endTime);
  }

  if (current.capacity !== baseline.capacity) {
    patch.capacity = parseInt(current.capacity, 10);
  }

  return patch;
}
