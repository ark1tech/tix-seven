"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyableId({
  id,
  className,
}: {
  id: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  if (!id) {
    return (
      <span className="text-muted-foreground/40 font-mono text-xs px-2">—</span>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between cursor-pointer w-full gap-2 transition-all duration-200 px-2 py-1.5 rounded-md border border-transparent hover:border-border/40 hover:bg-muted/30",
        className,
      )}
      onClick={onCopy}
      title={id}>
      <span className="font-mono text-xs text-muted-foreground font-medium leading-none truncate flex-1">
        {id}
      </span>
      <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0">
        <Check
          className={cn(
            "h-3 w-3 text-emerald-500 transition-all duration-300 absolute",
            copied
              ? "opacity-100 scale-100"
              : "opacity-0 scale-50 pointer-events-none",
          )}
        />
        <Copy
          className={cn(
            "h-3 w-3 text-muted-foreground transition-all duration-200 absolute",
            copied
              ? "opacity-0 scale-50"
              : "opacity-0 group-hover:opacity-40 scale-100",
          )}
        />
      </div>
    </div>
  );
}
