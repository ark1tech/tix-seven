import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function CreateEventCard({ className }: { className?: string }) {
  return (
    <Link href="/events/new" className={cn("block group h-full", className)}>
      <Card className="h-full border-dashed ring-0 border-2 border-muted-foreground/20 bg-muted/5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center min-h-55 gap-4">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-primary/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative h-12 w-12 rounded-full border border-muted-foreground/20 bg-background flex items-center justify-center group-hover:border-primary/50 group-hover:scale-110 transition-all duration-300">
            <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 text-center px-4">
          <span className="text-sm font-semibold tracking-tight text-foreground/70 group-hover:text-foreground transition-colors duration-300">
            Create New Event
          </span>
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-37.5">
            Schedule a new event and start selling tickets
          </p>
        </div>
      </Card>
    </Link>
  );
}
