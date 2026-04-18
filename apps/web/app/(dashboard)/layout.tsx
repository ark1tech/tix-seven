import { createClient, isMockMode } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import SidebarNav from "@/components/dashboard/SidebarNav";
import DebugOverlay from "@/components/debug/DebugOverlay";

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

  const mock = await isMockMode();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r bg-sidebar p-4 gap-6">
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ticket className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">TixSeven</span>
        </div>
        <SidebarNav />
        <div className="mt-auto">
          {/* TODO: replace with a server action for sign-out */}
          <form action="/api/auth/signout" method="post">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              type="submit"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto bg-background">{children}</main>
      {process.env.NEXT_PUBLIC_DEBUG_TOOLS === "true" && (
        <DebugOverlay isMock={mock} />
      )}
    </div>
  );
}
