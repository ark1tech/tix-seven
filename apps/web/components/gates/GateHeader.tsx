"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Gate } from "@tix-seven/types";

interface Props {
  gate?: Gate;
}

export default function GateHeader({ gate }: Props) {
  const pathname = usePathname();
  const isRoot = pathname === "/gates";
  const isNew = pathname === "/gates/new";
  const isEdit = pathname.endsWith("/edit");
  const isDetail = gate && !isEdit;

  return (
    <div className="pb-5 border-b mb-8">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Link
          href="/gates"
          className={cn(
            "hover:text-foreground transition-colors duration-150",
            isRoot ? "text-foreground cursor-default" : ""
          )}
        >
          Gates
        </Link>
        {isNew && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Register Gate</span>
          </>
        )}
        {gate && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link
              href={`/gates/${gate.gate_id}`}
              className={cn(
                "transition-colors duration-150",
                isDetail ? "text-foreground cursor-default" : "hover:text-foreground"
              )}
            >
              {gate.location}
            </Link>
          </>
        )}
        {isEdit && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Edit</span>
          </>
        )}
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "Register Gate" : gate ? gate.location : "Gates"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isNew 
              ? "Connect a new hardware gate to your venue" 
              : gate 
                ? "Manage access points and hardware status"
                : "List of all access points and hardware status"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isRoot && (
            <Link
              href="/gates/new"
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}
            >
              <Plus className="h-4 w-4" />
              Register Gate
            </Link>
          )}
          {isDetail && (
            <Link
              href={`/gates/${gate.gate_id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit Gate
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
