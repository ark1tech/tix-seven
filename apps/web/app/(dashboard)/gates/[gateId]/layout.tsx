import { getGate } from "@/lib/db/gates";
import GateHeader from "@/components/gates/GateHeader";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/utils";

export default async function GateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;
  if (!isUuid(gateId)) notFound();

  const gate = await getGate(gateId);
  if (!gate) notFound();

  return (
    <div className="flex flex-col">
      <GateHeader gate={gate} />
      {children}
    </div>
  );
}