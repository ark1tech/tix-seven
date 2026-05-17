"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function matchesRegistrySearch(
  fields: readonly string[],
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return true;
  }
  return fields.some((field) => field.toLowerCase().includes(normalized));
}

export function RegistryTableSearch({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}) {
  const hasValue = value.length > 0;

  function clearSearch() {
    onValueChange("");
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-8 w-36 pl-7 text-xs md:text-xs font-medium text-muted-foreground placeholder:text-muted-foreground placeholder:font-medium",
          "border border-input/60 bg-transparent shadow-none transition-colors",
          "hover:bg-muted/60 hover:border-input",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-muted focus-visible:text-foreground",
          hasValue ? "pr-7" : "pr-2",
          "sm:w-44 rounded-md",
        )}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="Clear search"
          className={cn(
            "absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm",
            "text-muted-foreground transition-[color,box-shadow,background-color]",
            "hover:bg-muted/60 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted",
            "active:bg-muted/80 active:ring-2 active:ring-muted",
          )}>
          <X className="size-3.5 shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
