import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Gate } from "@tix-seven/types";

export function GateStatusBadge({ status }: { status: Gate["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        status === "ONLINE"
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
        )}
      />
      {status === "ONLINE" ? "Online" : "Offline"}
    </Badge>
  );
}