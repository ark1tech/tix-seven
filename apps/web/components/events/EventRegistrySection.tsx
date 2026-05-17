"use client";

import { useEffect, useState } from "react";
import { useEventExport } from "@/components/events/event-export-context";
import TicketTable from "@/components/tickets/TicketTable";
import GateRegistryTable from "@/components/gates/GateRegistryTable";
import {
  RegistryChipTabs,
  type RegistryTab,
} from "@/components/events/RegistryChipTabs";
import type { AssignedGate, Ticket } from "@tix-seven/types";

export function EventRegistrySection({
  eventId,
  venueId,
  isMutable,
  initialTickets,
  initialGates,
}: {
  eventId: string;
  venueId: string;
  isMutable: boolean;
  initialTickets: Ticket[];
  initialGates: AssignedGate[];
}) {
  const [activeTab, setActiveTab] = useState<RegistryTab>("tickets");
  const { setActiveRegistryTab } = useEventExport();

  useEffect(() => {
    setActiveRegistryTab(activeTab);
  }, [activeTab, setActiveRegistryTab]);

  const registryTabs = (
    <RegistryChipTabs value={activeTab} onValueChange={setActiveTab} />
  );

  return (
    <div className="flex flex-col gap-4">
      {activeTab === "tickets" ? (
        <TicketTable
          eventId={eventId}
          initialTickets={initialTickets}
          registryTabs={registryTabs}
        />
      ) : (
        <GateRegistryTable
          eventId={eventId}
          venueId={venueId}
          initialGates={initialGates}
          isMutable={isMutable}
          registryTabs={registryTabs}
        />
      )}
    </div>
  );
}
