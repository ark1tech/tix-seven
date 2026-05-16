import { Card, CardContent } from "@/components/ui/card";
import { Ticket, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { TicketSummary, LogSummary } from "@tix-seven/types";

interface Props {
  ticketSummary: TicketSummary;
  logSummary: LogSummary;
  capacity: number;
}

export default function EventStats({ ticketSummary, logSummary, capacity }: Props) {
  const stats = [
    {
      label: "Tickets Issued",
      value: ticketSummary.total,
      sub: `of ${capacity} capacity`,
      icon: Ticket,
      bandClass: "bg-amber-50 border-amber-100",
      iconClass: "text-amber-500",
      labelClass: "text-amber-700",
    },
    {
      label: "Scanned In",
      value: logSummary.granted,
      sub: "successful entries",
      icon: CheckCircle2,
      bandClass: "bg-emerald-50 border-emerald-100",
      iconClass: "text-emerald-500",
      labelClass: "text-emerald-700",
    },
    {
      label: "Denied",
      value: logSummary.denied,
      sub: "failed scans",
      icon: XCircle,
      bandClass: "bg-red-50 border-red-100",
      iconClass: "text-red-500",
      labelClass: "text-red-700",
    },
    // Show timeout or error card only when non-zero; it's operational noise when zero and alarming when non-zero
    ...(logSummary.timeout_or_error > 0
      ? [
          {
            label: "Errors",
            value: logSummary.timeout_or_error,
            sub: "timeouts or server errors",
            icon: AlertTriangle,
            bandClass: "bg-amber-50 border-amber-100",
            iconClass: "text-amber-500",
            labelClass: "text-amber-700",
          },
        ]
      : []),
  ];

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
      }}
    >
      {stats.map(({ label, value, sub, icon: Icon, bandClass, iconClass, labelClass }) => (
        <Card key={label} className="p-0 gap-0">
          <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${bandClass}`}>
            <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
            <span className={`text-sm font-medium ${labelClass}`}>{label}</span>
          </div>
          <CardContent className="pt-4 pb-5 px-5">
            <p className="text-4xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}