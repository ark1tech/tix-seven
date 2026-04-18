import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@tix-seven/types";

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tickets issued yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket ID</TableHead>
          <TableHead>UIN Hash</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Seat</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Issued At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-mono text-xs">{ticket.id.slice(0, 8)}…</TableCell>
            <TableCell className="font-mono text-xs">{ticket.uin_hash.slice(0, 12)}…</TableCell>
            <TableCell>
              <Badge variant={ticket.tier === "vip" ? "default" : "secondary"}>
                {ticket.tier.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell>{ticket.seat}</TableCell>
            <TableCell>
              <Badge variant={ticket.status === "used" ? "destructive" : "outline"}>
                {ticket.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              <time suppressHydrationWarning>
                {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(ticket.purchase_timestamp))}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
