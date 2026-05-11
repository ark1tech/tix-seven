import { getGate } from "@/lib/db/gates";
import GateHeader from "@/components/gates/GateHeader";
import { notFound } from "next/navigation";

export default async function GateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  const gate = await getGate(gateId);

  if (!gate) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <GateHeader gate={gate} />
      {children}
    </div>
  );
}
