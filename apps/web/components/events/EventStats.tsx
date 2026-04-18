import { Badge } from "@/components/ui/badge";
import type { EventStats } from "@tix-seven/types";

interface Props {
  stats: EventStats;
  capacity: number;
}

export default function EventStats({ stats, capacity }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Badge variant="secondary">
        Sold: {stats.sold} / {capacity}
      </Badge>
      <Badge variant="secondary">Scanned in: {stats.scanned}</Badge>
      <Badge variant="destructive">Denied: {stats.denied}</Badge>
    </div>
  );
}
