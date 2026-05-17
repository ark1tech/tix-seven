"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { GateStatus } from "@tix-seven/types";

function isGateStatus(value: string | null): value is GateStatus {
  return value === "ONLINE" || value === "OFFLINE";
}

function statusLabel(status: GateStatus): string {
  return status === "ONLINE" ? "Online" : "Offline";
}

function statusChipClass(status: GateStatus): string {
  return status === "ONLINE"
    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-open:bg-emerald-100"
    : "bg-red-50 text-red-700 hover:bg-red-100 data-open:bg-red-100";
}

function statusDotClass(status: GateStatus, loading: boolean): string {
  if (loading) return "animate-pulse bg-current";
  return status === "ONLINE" ? "bg-emerald-500" : "bg-red-500";
}

const statusChipLayoutClass =
  "inline-flex h-auto min-h-0 w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-none";

function StatusChipLabel({
  status,
  loading,
}: {
  status: GateStatus;
  loading: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          statusDotClass(status, loading),
        )}
      />
      {loading ? "Saving…" : statusLabel(status)}
    </>
  );
}

export function GateStatusSelect({
  status,
  loading,
  disabled,
  onStatusChange,
}: {
  status: GateStatus;
  loading: boolean;
  disabled: boolean;
  onStatusChange: (next: GateStatus) => void;
}) {
  if (disabled) {
    return (
      <span className={cn(statusChipLayoutClass, statusChipClass(status))}>
        <StatusChipLabel status={status} loading={loading} />
      </span>
    );
  }

  return (
    <Select
      modal={false}
      value={status}
      onValueChange={(value) => {
        if (!isGateStatus(value) || value === status) return;
        onStatusChange(value);
      }}>
      <SelectTrigger
        size="sm"
        disabled={loading}
        className={cn(
          statusChipLayoutClass,
          "justify-start gap-1 border-0 py-0.5 pl-2.5 pr-1.5 shadow-none",
          "data-[size=sm]:h-auto data-[size=sm]:min-h-0 data-[size=sm]:rounded-full",
          "focus-visible:ring-1 focus-visible:ring-ring/25",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "[&_[data-slot=select-value]]:w-auto [&_[data-slot=select-value]]:gap-0",
          "[&>svg:last-child]:ml-0 [&>svg:last-child]:size-2.5 [&>svg:last-child]:opacity-35",
          statusChipClass(status),
        )}>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              statusDotClass(status, loading),
            )}
          />
          <SelectValue>{loading ? "Saving…" : statusLabel(status)}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-28 p-1">
        <SelectItem value="ONLINE">Online</SelectItem>
        <SelectItem value="OFFLINE">Offline</SelectItem>
      </SelectContent>
    </Select>
  );
}
