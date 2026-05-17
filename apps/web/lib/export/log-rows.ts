import { formatPhtDateTimeMedium } from "@/lib/datetime-pht";
import type { Log } from "@tix-seven/types";
import type { ExportColumn, ExportRow } from "./types";

export const LOG_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "ticket_id", header: "Ticket ID" },
  { key: "result", header: "Result" },
  { key: "reason", header: "Reason" },
  { key: "time", header: "Time" },
  { key: "gate", header: "Gate" },
];

const RESULT_LABELS: Record<Log["result"], string> = {
  GRANTED: "Granted",
  DENIED: "Denied",
  TIMEOUT: "Timeout",
  ERROR: "Error",
};

function formatDenialReasonLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatGateDisplay(log: Log): string {
  if (log.gate_location_snapshot) {
    return log.gate_location_snapshot;
  }
  return log.raw_gate_id_snapshot;
}

export function logsToExportRows(logs: Log[]): ExportRow[] {
  return logs.map((log) => ({
    ticket_id: log.ticket_id ?? "",
    result: RESULT_LABELS[log.result] ?? log.result,
    reason: log.denial_reason ? formatDenialReasonLabel(log.denial_reason) : "",
    time: formatPhtDateTimeMedium(log.timestamp),
    gate: formatGateDisplay(log),
  }));
}
