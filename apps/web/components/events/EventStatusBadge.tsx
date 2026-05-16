import { cn } from "@/lib/utils";
import type { EventStatus } from "@tix-seven/types";

const STATUS_CONFIG: Record<
  EventStatus,
  { label: string; dot: string; pill: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    dot: "bg-sky-400",
    pill: "bg-sky-50 text-sky-700 border-sky-100",
  },
  ACTIVE: {
    label: "Active",
    dot: "bg-emerald-400 animate-pulse",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  CONCLUDED: {
    label: "Concluded",
    dot: "bg-zinc-400",
    pill: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-red-400",
    pill: "bg-red-50 text-red-700 border-red-100",
  },
};

interface Props {
  status: EventStatus;
  className?: string;
}

export function EventStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.pill,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}