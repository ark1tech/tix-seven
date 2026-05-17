"use client";

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { fetchExportDataAction } from "@/app/(dashboard)/events/[eventId]/export-action";
import { REGISTRY_TABS } from "@/components/events/RegistryChipTabs";
import { useEventExport } from "@/components/events/event-export-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { buildExportDataset } from "@/lib/export/build-dataset";
import {
  buildExportFilename,
  downloadExportFile,
} from "@/lib/export/download-file";
import type {
  ExportFormat,
  ExportRegistry,
  ExportScope,
} from "@/lib/export/types";
import { cn } from "@/lib/utils";
import type { AssignedGate, Log, Ticket } from "@tix-seven/types";

type ExportMode = "registry" | "logs";
type Phase = "idle" | "exporting" | "error";

interface Props {
  eventId: string;
  mode: ExportMode;
  children: React.ReactElement;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
  { id: "xlsx", label: "Excel (.xlsx)" },
];

const SCOPE_OPTIONS: { id: ExportScope; label: string }[] = [
  { id: "all", label: "All rows" },
  { id: "filtered", label: "Current view" },
];

function formatExportError(error: string, detail?: string): string {
  if (error === "unauthorized") {
    return "You are not signed in. Refresh the page and try again.";
  }
  if (error === "event_not_found") {
    return "This event could not be found.";
  }
  if (detail) {
    return `Export failed: ${detail}`;
  }
  return "Export failed. Please try again.";
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabledIds,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabledIds?: Set<T>;
}) {
  return (
    <fieldset className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={label}>
        {options.map((option) => {
          const isDisabled = disabledIds?.has(option.id) ?? false;
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                isDisabled &&
                  "opacity-40 cursor-not-allowed hover:text-muted-foreground",
              )}>
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function resolveFilteredRows(
  registry: ExportRegistry,
  snapshots: ReturnType<typeof useEventExport>["snapshots"],
): Ticket[] | AssignedGate[] | Log[] | null {
  const snapshot = snapshots[registry];
  if (!snapshot) return null;
  return snapshot.rows;
}

export function ExportPopover({ eventId, mode, children }: Props) {
  const { activeRegistryTab, snapshots } = useEventExport();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const defaultRegistry: ExportRegistry =
    mode === "logs" ? "logs" : activeRegistryTab ?? "tickets";

  const [registry, setRegistry] =
    React.useState<ExportRegistry>(defaultRegistry);
  const [scope, setScope] = React.useState<ExportScope>("all");
  const [format, setFormat] = React.useState<ExportFormat>("csv");

  const isExporting = phase === "exporting";
  const effectiveRegistry: ExportRegistry = mode === "logs" ? "logs" : registry;

  const filteredScopeDisabled =
    mode === "registry" &&
    activeRegistryTab !== null &&
    registry !== activeRegistryTab;

  const effectiveScope: ExportScope =
    scope === "filtered" && filteredScopeDisabled ? "all" : scope;

  const scopeDisabledIds = React.useMemo(() => {
    const ids = new Set<ExportScope>();
    if (filteredScopeDisabled) {
      ids.add("filtered");
    }
    return ids;
  }, [filteredScopeDisabled]);

  const previewRowCount = React.useMemo(() => {
    if (effectiveScope === "all") return null;
    const rows = resolveFilteredRows(effectiveRegistry, snapshots);
    return rows?.length ?? 0;
  }, [effectiveScope, effectiveRegistry, snapshots]);

  const isEmptyExport =
    effectiveScope === "filtered" &&
    previewRowCount !== null &&
    previewRowCount === 0;

  const resetForm = React.useCallback(() => {
    setRegistry(mode === "logs" ? "logs" : activeRegistryTab ?? "tickets");
    setScope("all");
    setFormat("csv");
    setPhase("idle");
    setErrorMessage(null);
  }, [mode, activeRegistryTab]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isExporting) return;
      if (nextOpen) {
        resetForm();
      }
      setOpen(nextOpen);
    },
    [isExporting, resetForm],
  );

  async function onExport() {
    if (isExporting || isEmptyExport) return;

    setPhase("exporting");
    setErrorMessage(null);

    let rows: Ticket[] | AssignedGate[] | Log[];

    if (effectiveScope === "filtered") {
      const filtered = resolveFilteredRows(effectiveRegistry, snapshots);
      if (!filtered) {
        setErrorMessage(
          "No filtered data available. Switch to the matching tab.",
        );
        setPhase("error");
        return;
      }
      rows = filtered;
    } else {
      const result = await fetchExportDataAction(eventId, effectiveRegistry);
      if (!result.ok) {
        setErrorMessage(formatExportError(result.error, result.detail));
        setPhase("error");
        return;
      }
      rows = result.rows;
    }

    if (rows.length === 0) {
      setErrorMessage("No rows to export.");
      setPhase("error");
      return;
    }

    try {
      const dataset = buildExportDataset(effectiveRegistry, rows);
      const filename = buildExportFilename(eventId, effectiveRegistry, format);
      await downloadExportFile(dataset, format, filename);
      handleOpenChange(false);
    } catch {
      setErrorMessage(
        "Export failed while generating the file. Please try again.",
      );
      setPhase("error");
    }
  }

  const registryOptions = REGISTRY_TABS.map((tab) => ({
    id: tab.id as ExportRegistry,
    label: tab.label,
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={children}
        className="cursor-pointer"
        onClick={() => handleOpenChange(true)}
      />

      <DialogPortal>
        <DialogOverlay className="bg-black/60 duration-200" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-2xl",
            "p-0 overflow-hidden flex flex-col",
            "duration-200 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}>
          {phase === "exporting" ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 animate-in fade-in zoom-in-95 duration-300">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
              <p className="text-sm font-medium text-foreground">
                Preparing export…
              </p>
            </div>
          ) : (
            <div className="flex flex-col animate-in fade-in duration-200">
              <div className="px-6 pt-6 pb-4 space-y-5">
                <DialogHeader>
                  <DialogTitle>Export data</DialogTitle>
                  <DialogDescription>
                    {mode === "registry"
                      ? "Choose a registry, row scope, and file format."
                      : "Choose row scope and file format for the entry log."}
                  </DialogDescription>
                </DialogHeader>

                {phase === "error" && errorMessage && (
                  <div className="flex items-start gap-2.5 text-sm leading-snug text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10">
                    <AlertCircle
                      className="h-4 w-4 shrink-0 mt-0.5"
                      aria-hidden
                    />
                    <p className="min-w-0">{errorMessage}</p>
                  </div>
                )}

                {mode === "registry" && (
                  <ChoiceGroup
                    label="Registry"
                    options={registryOptions}
                    value={registry}
                    onChange={(next) => {
                      setRegistry(next);
                      if (
                        activeRegistryTab !== null &&
                        next !== activeRegistryTab
                      ) {
                        setScope("all");
                      }
                    }}
                  />
                )}

                <ChoiceGroup
                  label="Rows"
                  options={SCOPE_OPTIONS}
                  value={scope}
                  onChange={setScope}
                  disabledIds={scopeDisabledIds}
                />

                {filteredScopeDisabled && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Switch to the{" "}
                    {registry === "tickets"
                      ? "Ticket registry"
                      : "Gate registry"}{" "}
                    tab to export the current view.
                  </p>
                )}

                <ChoiceGroup
                  label="Format"
                  options={FORMAT_OPTIONS}
                  value={format}
                  onChange={setFormat}
                />

                {isEmptyExport && (
                  <p className="text-xs text-muted-foreground">
                    No rows to export for the current view.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  className="text-muted-foreground hover:bg-transparent">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onExport()}
                  disabled={isEmptyExport}
                  className="shadow-xs">
                  Export
                </Button>
              </div>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
