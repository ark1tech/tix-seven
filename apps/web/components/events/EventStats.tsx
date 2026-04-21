import { Card, CardContent } from "@/components/ui/card";
import { Ticket, CheckCircle2, XCircle } from "lucide-react";
import type { EventStats } from "@tix-seven/types";

interface Props {
  stats: EventStats;
  capacity: number;
}

const statConfig = [
  {
    label: "Tickets Sold",
    value: (s: EventStats) => s.sold,
    sub: (_s: EventStats, cap: number) => `of ${cap} capacity`,
    icon: Ticket,
    bandClass: "bg-amber-50 border-amber-100",
    iconClass: "text-amber-500",
    labelClass: "text-amber-700",
  },
  {
    label: "Scanned In",
    value: (s: EventStats) => s.scanned,
    sub: () => "successful entries",
    icon: CheckCircle2,
    bandClass: "bg-emerald-50 border-emerald-100",
    iconClass: "text-emerald-500",
    labelClass: "text-emerald-700",
  },
  {
    label: "Denied",
    value: (s: EventStats) => s.denied,
    sub: () => "failed scans",
    icon: XCircle,
    bandClass: "bg-red-50 border-red-100",
    iconClass: "text-red-500",
    labelClass: "text-red-700",
  },
];

export default function EventStats({ stats, capacity }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {statConfig.map(({ label, value, sub, icon: Icon, bandClass, iconClass, labelClass }) => (
        <Card key={label} className="p-0 gap-0">
          <div className={`flex items-center gap-2 px-5 py-3.5 border-b ${bandClass}`}>
            <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
            <span className={`text-sm font-medium ${labelClass}`}>{label}</span>
          </div>
          <CardContent className="pt-4 pb-5 px-5">
            <p className="text-4xl font-bold tracking-tight">{value(stats)}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub(stats, capacity)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
