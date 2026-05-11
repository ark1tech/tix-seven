import { getGates } from "@/lib/db/gates";
import { getEvents } from "@/lib/db/events";
import GateTable from "@/components/gates/GateTable";
import GateHeader from "@/components/gates/GateHeader";

export default async function GatesPage() {
  const [gates, events] = await Promise.all([getGates(), getEvents()]);

  return (
    <div className="flex flex-col">
      <GateHeader />
      <div className="w-full">
        <GateTable gates={gates} events={events} />
      </div>
    </div>
  );
}
