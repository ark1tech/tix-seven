import { getGates } from "@/lib/db/gates";
import { getEvents } from "@/lib/db/events";
import GateTable from "@/components/gates/GateTable";
import GateForm from "@/components/gates/GateForm";

export default async function GatesPage() {
  const [gates, events] = await Promise.all([getGates(), getEvents()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Gates</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GateTable gates={gates} events={events} />
        </div>
        <div>
          <h2 className="text-lg font-medium mb-4">Register Gate</h2>
          <GateForm events={events} />
        </div>
      </div>
    </div>
  );
}
