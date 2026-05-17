import { gatesToExportRows, GATE_EXPORT_COLUMNS } from "./gate-rows";
import { logsToExportRows, LOG_EXPORT_COLUMNS } from "./log-rows";
import { ticketsToExportRows, TICKET_EXPORT_COLUMNS } from "./ticket-rows";
import type { ExportDataset, ExportRegistry } from "./types";
import type { AssignedGate, Log, Ticket } from "@tix-seven/types";

export function buildExportDataset(
  registry: ExportRegistry,
  rows: Ticket[] | AssignedGate[] | Log[],
): ExportDataset {
  if (registry === "tickets") {
    return {
      registry,
      columns: TICKET_EXPORT_COLUMNS,
      rows: ticketsToExportRows(rows as Ticket[]),
    };
  }

  if (registry === "gates") {
    return {
      registry,
      columns: GATE_EXPORT_COLUMNS,
      rows: gatesToExportRows(rows as AssignedGate[]),
    };
  }

  return {
    registry,
    columns: LOG_EXPORT_COLUMNS,
    rows: logsToExportRows(rows as Log[]),
  };
}
