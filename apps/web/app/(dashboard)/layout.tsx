import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/dashboard/SidebarNav";

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

  return (
    <div className="flex min-h-dvh bg-(--background-page) p-3 gap-3">
      <SidebarNav />
      <main className="flex-1 rounded-xl bg-background shadow-sm p-8 overflow-auto">{children}</main>
    </div>
  );
}
