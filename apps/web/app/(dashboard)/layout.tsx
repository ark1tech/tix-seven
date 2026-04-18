import Link from "next/link";
import { createClient, isMockMode } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
      <aside className="flex w-56 flex-col border-r bg-background p-4 gap-2">
        <span className="px-2 py-1 text-sm font-semibold tracking-tight">
          TixSeven
        </span>
        <Separator />
        <nav className="flex flex-col gap-1 mt-2">
          <Link
            href="/events"
            className="rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Events
          </Link>
          <Link
            href="/gates"
            className="rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            Gates
          </Link>
        </nav>
        <div className="mt-auto">
          {/* TODO: replace with a server action for sign-out */}
          <form action="/api/auth/signout" method="post">
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
      {process.env.NEXT_PUBLIC_DEBUG_TOOLS === "true" && (
        <DebugOverlay isMock={mock} />
      )}
    </div>
  );
}
