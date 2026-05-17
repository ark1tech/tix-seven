"use client";

import { CancelEventButton } from "@/components/events/CancelEventButton";
import { EventHeaderActions } from "@/components/events/event-header-actions";

interface Props {
  eventId: string;
  eventName: string;
  isMutable: boolean;
}

export function EventPageCancelAction({
  eventId,
  eventName,
  isMutable,
}: Props) {
  if (!isMutable) {
    return null;
  }

  return (
    <EventHeaderActions>
      <CancelEventButton eventId={eventId} eventName={eventName} />
    </EventHeaderActions>
  );
}
