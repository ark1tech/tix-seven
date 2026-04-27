/**
 * Event times in Postgres are `timestamp without time zone` and are always meant to be
 * Philippine (Asia/Manila) wall clock — no DST. Use this module for parsing, displaying,
 * and serializing so SSR and the browser match and we never `toISOString()` away PHT
 * from `datetime-local` inputs.
 */

import { z } from "zod";

export const PHT_IANA = "Asia/Manila" as const;
export const PHT_LOCALE = "en-PH" as const;

const DT_LOCAL_MIN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/; // YYYY-MM-DDTHH:mm (form submit)

/** True if the string includes an offset or Z, so it represents an absolute instant. */
function hasExplicitOffsetOrZ(s: string): boolean {
  return /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s.trim());
}

/**
 * Interprets DB/API strings that are NOT zone-qualified as PHT wall clock (append +08:00)
 * for a stable `Date` (same in Node and browser). If the value has Z/offset, parses as
 * ISO (instant) — useful while old payloads may still be ISO in flight.
 */
export function parsePhtEventTimestampToDate(raw: string): Date {
  const s = raw.trim();
  if (!s) return new Date(NaN);
  if (hasExplicitOffsetOrZ(s)) {
    return new Date(s.replace(" ", "T"));
  }
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  return new Date(`${normalized}+08:00`);
}

/**
 * Renders a `Date` in Asia/Manila for DB storage as `YYYY-MM-DD HH:mm:ss` (and optional
 * fractional seconds truncated to milliseconds if present).
 */
export function formatInstantAsPhtSqlTimestamp(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHT_IANA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const partMap: Partial<Record<Intl.DateTimeFormatPart["type"], string>> = {};
  for (const p of f.formatToParts(d)) {
    if (p.type !== "literal") {
      partMap[p.type] = p.value;
    }
  }
  const y = partMap.year ?? "0";
  const m = partMap.month ?? "0";
  const day = partMap.day ?? "0";
  const h = partMap.hour ?? "0";
  const min = partMap.minute ?? "0";
  const sec = partMap.second ?? "0";
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

/**
 * Coerces an API/client string to a PHT wall-clock `YYYY-MM-DD HH:mm:ss` for Supabase
 * / Postgres `timestamp without time zone`.
 */
export function coerceApiBodyToPhtSqlTimestamp(s: string): string {
  const t = s.trim();
  if (!t) {
    return "";
  }
  if (hasExplicitOffsetOrZ(t) || t.endsWith("Z")) {
    return formatInstantAsPhtSqlTimestamp(new Date(t));
  }
  // Plain wall clock (from form: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm[:ss[.ms]])
  const spaceForm = t.replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(spaceForm)) {
    return `${spaceForm}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(spaceForm)) {
    return spaceForm.length >= 19 ? spaceForm.slice(0, 19) : spaceForm;
  }
  return spaceForm;
}

/**
 * `datetime-local` value (no timezone) for an event time stored as PHT wall in DB/JSON.
 */
export function eventTimestampToDatetimeLocalValue(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (hasExplicitOffsetOrZ(s)) {
    // Old ISO — show local picker = Manila wall
    return formatInstantAsPhtSqlTimestamp(new Date(s)).replace(" ", "T").slice(0, 16);
  }
  const noMs = s.replace("T", " ").split(".")[0] ?? s;
  const [d, t] = noMs.split(/[ T]/);
  if (!d || !t) return "";
  const [hh, mm] = t.split(":");
  if (hh == null || mm == null) return "";
  return `${d}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`.slice(0, 16);
}

/**
 * For API body validation: string -> normalized `YYYY-MM-DD HH:mm:ss` (PHT wall)
 */
export const phtEventTimestampZ = z
  .string()
  .min(1, "Time is required")
  .transform((s) => coerceApiBodyToPhtSqlTimestamp(s))
  .refine(
    (out) => {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(out)) {
        return false;
      }
      return !Number.isNaN(
        parsePhtEventTimestampToDate(
          out.includes("T") ? out : out.replace(" ", "T")
        ).getTime()
      );
    },
    { message: "Invalid event timestamp" }
  );

/**
 * From `datetime-local` input value, produce PHT wall `YYYY-MM-DD HH:mm:ss` (UI has no
 * timezone; we treat the components as PHT as per product spec).
 */
export function datetimeLocalInputToPhtSqlTimestamp(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (DT_LOCAL_MIN.test(t)) {
    return t.replace("T", " ") + ":00";
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(t)) {
    return t.replace("T", " ").slice(0, 19);
  }
  return t.replace("T", " ");
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(
  key: string,
  init: () => Intl.DateTimeFormat
): Intl.DateTimeFormat {
  const hit = dtfCache.get(key);
  if (hit) return hit;
  const f = init();
  dtfCache.set(key, f);
  return f;
}

export function formatEventDateMediumPht(isoOrDb: string): string {
  const d = parsePhtEventTimestampToDate(isoOrDb);
  return getDtf("med", () =>
    new Intl.DateTimeFormat(PHT_LOCALE, {
      timeZone: PHT_IANA,
      dateStyle: "medium",
    })
  ).format(d);
}

export function formatEventMonthShortPht(isoOrDb: string): string {
  const d = parsePhtEventTimestampToDate(isoOrDb);
  return getDtf("mon", () =>
    new Intl.DateTimeFormat(PHT_LOCALE, {
      timeZone: PHT_IANA,
      month: "short",
    })
  ).format(d);
}

export function formatEventDayNumericPht(isoOrDb: string): string {
  const d = parsePhtEventTimestampToDate(isoOrDb);
  return getDtf("day", () =>
    new Intl.DateTimeFormat(PHT_LOCALE, {
      timeZone: PHT_IANA,
      day: "numeric",
    })
  ).format(d);
}

export function formatPhtDateTimeShort(isoOrDb: string): string {
  const d = parsePhtEventTimestampToDate(isoOrDb);
  return getDtf("dateTimeShort", () =>
    new Intl.DateTimeFormat(PHT_LOCALE, {
      timeZone: PHT_IANA,
      dateStyle: "short",
      timeStyle: "short",
    })
  ).format(d);
}

export function formatPhtTimeMedium(isoOrDb: string): string {
  const d = parsePhtEventTimestampToDate(isoOrDb);
  return getDtf("timeMedium", () =>
    new Intl.DateTimeFormat(PHT_LOCALE, {
      timeZone: PHT_IANA,
      timeStyle: "medium",
    })
  ).format(d);
}
