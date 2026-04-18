import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@tix-seven/types";

export default function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="text-base">{event.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-1">
          <span>{new Date(event.date).toLocaleDateString()}</span>
          <span>{event.venue}</span>
          <span>Capacity: {event.capacity}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
