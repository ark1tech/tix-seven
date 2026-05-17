import { formatPhtDateTimeShort } from "@/lib/datetime-pht";
import type { Ticket } from "@tix-seven/types";
import type { ExportColumn, ExportRow } from "./types";

export const TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "ticket_id", header: "Ticket ID" },
  { key: "status", header: "Status" },
  { key: "issued_at", header: "Issued At" },
  { key: "link_id", header: "Link ID" },
  { key: "used_at", header: "Used At" },
];

function formatTicketStatus(status: Ticket["status"]): string {
  return status === "USED" ? "Used" : "Unused";
}

export function ticketsToExportRows(tickets: Ticket[]): ExportRow[] {
  return tickets.map((ticket) => ({
    ticket_id: ticket.ticket_id,
    status: formatTicketStatus(ticket.status),
    issued_at: formatPhtDateTimeShort(ticket.created_at),
    link_id: ticket.link_id ?? "",
    used_at: ticket.used_at ? formatPhtDateTimeShort(ticket.used_at) : "",
  }));
}
