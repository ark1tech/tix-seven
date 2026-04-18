import { Card, CardContent } from "@/components/ui/card";
import { Ticket, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
    iconClass: "text-primary",
  },
  {
    label: "Scanned In",
    value: (s: EventStats) => s.scanned,
    sub: () => "successful entries",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  {
    label: "Denied",
    value: (s: EventStats) => s.denied,
    sub: () => "failed scans",
    icon: XCircle,
    iconClass: "text-destructive",
  },
];

export default function EventStats({ stats, capacity }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {statConfig.map(({ label, value, sub, icon: Icon, iconClass }) => (
        <Card key={label}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {value(stats)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {sub(stats, capacity)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
