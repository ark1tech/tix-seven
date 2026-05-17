"use client";

import { useState, startTransition, useMemo, type ReactNode } from "react";
import { useRegisterExportSnapshot } from "@/components/events/event-export-context";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CopyableId } from "@/components/ui/copyable-id";
import {
  formatPhtDateTimeShort,
  parsePhtEventTimestampToDate,
} from "@/lib/datetime-pht";
import { cn } from "@/lib/utils";
import type { AssignedGate, GateStatus } from "@tix-seven/types";
import { Filter, ArrowUpDown } from "lucide-react";
import { GateStatusSelect } from "./GateStatusSelect";
import { GateRegistryConfirmDialog } from "./GateRegistryConfirmDialog";
import { RegisterGateDialog } from "./RegisterGateDialog";
import {
  matchesRegistrySearch,
  RegistryTableSearch,
} from "@/components/events/RegistryTableSearch";

type GateFilter = "All" | "Online" | "Offline";
type GateSort = "Newest" | "Oldest";

function isGateFilter(value: string | null): value is GateFilter {
  return value === "All" || value === "Online" || value === "Offline";
}

function isGateSort(value: string | null): value is GateSort {
  return value === "Newest" || value === "Oldest";
}

type LoadingAction = "status" | "remove";

type PendingAction =
  | { kind: "status"; gate: AssignedGate; nextStatus: GateStatus }
  | { kind: "remove"; gateId: string; location: string };

function gateStatusConfirmCopy(nextStatus: GateStatus): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  if (nextStatus === "ONLINE") {
    return {
      title: "Set gate online?",
      description:
        "This gate will accept scans for this event. Make sure it is ready before going online.",
      confirmLabel: "Set online",
    };
  }
  return {
    title: "Set gate offline?",
    description:
      "This gate will stop accepting scans for this event until you bring it back online.",
    confirmLabel: "Set offline",
  };
}

export default function GateRegistryTable({
  eventId,
  venueId,
  initialGates,
  isMutable,
  registryTabs,
}: {
  eventId: string;
  venueId: string;
  initialGates: AssignedGate[];
  isMutable: boolean;
  registryTabs: ReactNode;
}) {
  const router = useRouter();
  const [gates, setGates] = useState<AssignedGate[]>(initialGates);
  const [prevInitialGates, setPrevInitialGates] =
    useState<AssignedGate[]>(initialGates);
  const [filter, setFilter] = useState<GateFilter>("All");
  const [sort, setSort] = useState<GateSort>("Newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (initialGates !== prevInitialGates) {
    setPrevInitialGates(initialGates);
    setGates(initialGates);
  }

  function isLoading(gateId: string, action: LoadingAction) {
    return loading === `${gateId}:${action}`;
  }

  function isAnyLoading(gateId: string) {
    return loading?.startsWith(`${gateId}:`) ?? false;
  }

  async function patchGate(
    gateId: string,
    body: { status?: GateStatus; event_id?: string | null },
    action: LoadingAction,
  ): Promise<boolean> {
    setLoading(`${gateId}:${action}`);
    setActionError(null);

    const res = await fetch(`/api/gates/${gateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        typeof data.error === "string" ? data.error : "Failed to update gate";
      setActionError(message);
      setLoading(null);
      return false;
    }

    const updated = (await res.json()) as {
      gate_id: string;
      status: GateStatus;
    };

    if (body.event_id === null) {
      setGates((prev) => prev.filter((g) => g.gate_id !== gateId));
    } else if (body.status !== undefined) {
      setGates((prev) =>
        prev.map((g) =>
          g.gate_id === gateId ? { ...g, status: updated.status } : g,
        ),
      );
    }

    setLoading(null);
    startTransition(() => router.refresh());
    return true;
  }

  function requestStatusChange(gate: AssignedGate, nextStatus: GateStatus) {
    setPendingAction({ kind: "status", gate, nextStatus });
    setConfirmOpen(true);
  }

  function requestRemove(gate: AssignedGate) {
    setPendingAction({
      kind: "remove",
      gateId: gate.gate_id,
      location: gate.location,
    });
    setConfirmOpen(true);
  }

  function handleConfirmOpenChange(open: boolean) {
    if (!open && !loading) {
      setPendingAction(null);
    }
    setConfirmOpen(open);
  }

  function handleConfirm() {
    if (!pendingAction) return;

    if (pendingAction.kind === "status") {
      void patchGate(
        pendingAction.gate.gate_id,
        { status: pendingAction.nextStatus },
        "status",
      ).then((ok) => {
        if (ok) {
          setConfirmOpen(false);
          setPendingAction(null);
        }
      });
      return;
    }

    void patchGate(pendingAction.gateId, { event_id: null }, "remove").then(
      (ok) => {
        if (ok) {
          setConfirmOpen(false);
          setPendingAction(null);
        }
      },
    );
  }

  const confirmSubmitting =
    pendingAction !== null &&
    (pendingAction.kind === "status"
      ? isLoading(pendingAction.gate.gate_id, "status")
      : isLoading(pendingAction.gateId, "remove"));

  const confirmCopy =
    pendingAction?.kind === "status"
      ? gateStatusConfirmCopy(pendingAction.nextStatus)
      : pendingAction?.kind === "remove"
        ? {
            title: "Remove gate from event?",
            description: `“${pendingAction.location}” will remain registered at the venue but will no longer be assigned to this event. The gate must be offline before removal.`,
            confirmLabel: "Remove gate",
          }
        : null;

  const sortedGates = useMemo(() => {
    const filtered = gates.filter((g) => {
      if (filter === "Online" && g.status !== "ONLINE") return false;
      if (filter === "Offline" && g.status !== "OFFLINE") return false;
      return matchesRegistrySearch([g.gate_id, g.location], searchQuery);
    });

    return [...filtered].sort((a, b) => {
      const timeA = parsePhtEventTimestampToDate(a.assigned_at).getTime();
      const timeB = parsePhtEventTimestampToDate(b.assigned_at).getTime();
      return sort === "Newest" ? timeB - timeA : timeA - timeB;
    });
  }, [gates, filter, sort, searchQuery]);

  const exportSnapshot = useMemo(
    () => ({ registry: "gates" as const, rows: sortedGates }),
    [sortedGates],
  );
  useRegisterExportSnapshot(exportSnapshot);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {registryTabs}
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
          <Select
            modal={false}
            value={filter}
            onValueChange={(v) => {
              if (isGateFilter(v)) setFilter(v);
            }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-30 p-1">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="Offline">Offline</SelectItem>
            </SelectContent>
          </Select>

          <Select
            modal={false}
            value={sort}
            onValueChange={(v) => {
              if (isGateSort(v)) setSort(v);
            }}>
            <SelectTrigger className="h-8 px-2 text-xs border-transparent hover:bg-muted/60 transition-colors bg-transparent shadow-none w-auto gap-1.5 text-muted-foreground font-medium focus-visible:ring-0 data-open:bg-muted/80 data-open:text-foreground rounded-md">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="w-30 p-1">
              <SelectItem value="Newest">Newest</SelectItem>
              <SelectItem value="Oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          <RegistryTableSearch
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search"
          />

          <RegisterGateDialog
            eventId={eventId}
            venueId={venueId}
            disabled={!isMutable}
          />
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {sortedGates.length === 0 ? (
        <p className="text-sm text-muted-foreground p-3">
          No gates found matching the criteria.
        </p>
      ) : (
        <Table className="table-fixed w-full">
          <colgroup>
            <col className="w-1/3" />
            <col className="w-28" />
            <col />
            <col />
            {isMutable ? <col className="w-20" /> : null}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="py-2 px-3 text-xs">Gate ID</TableHead>
              <TableHead className="py-2 px-3 text-xs whitespace-nowrap">
                Status
              </TableHead>
              <TableHead className="py-2 px-3 text-xs">Location</TableHead>
              <TableHead className="py-2 px-3 text-xs whitespace-nowrap">
                Assigned at
              </TableHead>
              {isMutable ? (
                <TableHead className="py-2 px-3 w-20">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGates.map((gate) => (
              <TableRow key={gate.gate_id} className="group transition-colors">
                <TableCell className="py-2 px-3 overflow-hidden">
                  <CopyableId id={gate.gate_id} />
                </TableCell>

                <TableCell className="py-2 px-3 whitespace-nowrap">
                  <GateStatusSelect
                    status={gate.status}
                    loading={isLoading(gate.gate_id, "status")}
                    disabled={!isMutable || isAnyLoading(gate.gate_id)}
                    onStatusChange={(nextStatus) =>
                      requestStatusChange(gate, nextStatus)
                    }
                  />
                </TableCell>

                <TableCell className="py-2 px-3 overflow-hidden">
                  <span className="block text-xs text-muted-foreground truncate">
                    {gate.location}
                  </span>
                </TableCell>

                <TableCell className="py-2 px-3 text-xs text-muted-foreground overflow-hidden">
                  <time
                    className="block truncate"
                    dateTime={gate.assigned_at.replace(" ", "T")}>
                    {formatPhtDateTimeShort(gate.assigned_at)}
                  </time>
                </TableCell>

                {isMutable ? (
                  <TableCell className="py-2 px-1 w-20 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 px-2 text-xs opacity-0 group-hover:opacity-100",
                        "hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-opacity",
                        "focus-visible:opacity-100",
                        isAnyLoading(gate.gate_id) && "opacity-50",
                      )}
                      onClick={() => requestRemove(gate)}
                      disabled={isAnyLoading(gate.gate_id)}>
                      {isLoading(gate.gate_id, "remove")
                        ? "Removing…"
                        : "Remove"}
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <GateRegistryConfirmDialog
        open={confirmOpen && pendingAction !== null}
        onOpenChange={handleConfirmOpenChange}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description ?? ""}
        confirmLabel={confirmCopy?.confirmLabel ?? "Confirm"}
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        isSubmitting={confirmSubmitting}
        confirmVariant={
          pendingAction?.kind === "remove" ? "destructive" : "default"
        }
      />
    </div>
  );
}
