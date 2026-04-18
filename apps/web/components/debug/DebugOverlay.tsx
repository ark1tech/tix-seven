"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toggleMockMode } from "@/app/actions/debug";

export default function DebugOverlay({ isMock }: { isMock: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleMockMode(!isMock);
      router.refresh();
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-background border rounded-lg shadow-lg p-3 w-48 flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Debug Tools
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mock Data</span>
            <button
              onClick={handleToggle}
              disabled={pending}
              aria-label={isMock ? "Disable mock data" : "Enable mock data"}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:opacity-50",
                isMock ? "bg-orange-500" : "bg-input"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition-transform",
                  isMock ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Debug Tools"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold shadow-md transition-colors hover:bg-accent",
          isMock
            ? "bg-orange-500 text-white border-orange-500"
            : "bg-background text-muted-foreground"
        )}
      >
        DBG
      </button>
    </div>
  );
}
