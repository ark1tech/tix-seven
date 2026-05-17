import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/dashboard/SidebarNav";
import { requireAuth } from "@/lib/auth/require-auth";
import { getEvents } from "@/lib/gate-server/events";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { accessToken, traceId } = await requireAuth();
  const eventsResult = await getEvents(accessToken, traceId);
  const events = eventsResult.ok ? eventsResult.events : [];

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-(--background-page) p-3 gap-3">
      <SidebarNav events={events} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background p-8 shadow-sm">
        {children}
      </main>
    </div>
  );
}
