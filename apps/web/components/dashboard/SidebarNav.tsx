"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/gates", label: "Gates", icon: MonitorPlay },
];

export default function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
