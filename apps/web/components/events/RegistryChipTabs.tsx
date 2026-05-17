"use client";

import { cn } from "@/lib/utils";

export type RegistryTab = "tickets" | "gates";

export type ChipTab = { id: string; label: string };

export const REGISTRY_TABS: ChipTab[] = [
  { id: "tickets", label: "Ticket registry" },
  { id: "gates", label: "Gate registry" },
];

export const ENTRY_LOG_TABS: ChipTab[] = [{ id: "logs", label: "Logs" }];

const CHIP_ACTIVE = "bg-muted text-foreground";
const CHIP_INACTIVE = "text-muted-foreground hover:text-foreground";
const CHIP_BASE =
  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function RegistryChipTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  ariaLabel,
}: {
  tabs?: readonly { id: T; label: string }[];
  value: T;
  onValueChange?: (tab: T) => void;
  ariaLabel?: string;
}) {
  const resolvedTabs = (tabs ?? REGISTRY_TABS) as readonly {
    id: T;
    label: string;
  }[];
  const isStatic = resolvedTabs.length === 1 && onValueChange === undefined;

  return (
    <div
      className="flex items-center gap-1 mr-4"
      role="tablist"
      aria-label={ariaLabel ?? "Registry"}>
      {resolvedTabs.map((tab) => {
        const isActive = value === tab.id;
        const chipClassName = cn(
          CHIP_BASE,
          isActive ? CHIP_ACTIVE : CHIP_INACTIVE,
        );

        if (isStatic) {
          return (
            <span
              key={tab.id}
              role="tab"
              aria-selected={true}
              className={chipClassName}>
              {tab.label}
            </span>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange?.(tab.id)}
            className={chipClassName}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
