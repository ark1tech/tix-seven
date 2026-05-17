import { formatPhtDateTimeShort } from "@/lib/datetime-pht";
import type { AssignedGate } from "@tix-seven/types";
import type { ExportColumn, ExportRow } from "./types";

export const GATE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "gate_id", header: "Gate ID" },
  { key: "status", header: "Status" },
  { key: "location", header: "Location" },
  { key: "assigned_at", header: "Assigned At" },
];

function formatGateStatus(status: AssignedGate["status"]): string {
  return status === "ONLINE" ? "Online" : "Offline";
}

export function gatesToExportRows(gates: AssignedGate[]): ExportRow[] {
  return gates.map((gate) => ({
    gate_id: gate.gate_id,
    status: formatGateStatus(gate.status),
    location: gate.location,
    assigned_at: formatPhtDateTimeShort(gate.assigned_at),
  }));
}
