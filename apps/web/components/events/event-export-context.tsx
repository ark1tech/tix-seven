"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RegistryTab } from "@/components/events/RegistryChipTabs";
import type { ExportRegistry } from "@/lib/export/types";
import type { AssignedGate, Log, Ticket } from "@tix-seven/types";

type ExportSnapshot =
  | { registry: "tickets"; rows: Ticket[] }
  | { registry: "gates"; rows: AssignedGate[] }
  | { registry: "logs"; rows: Log[] };

interface EventExportContextValue {
  activeRegistryTab: RegistryTab | null;
  setActiveRegistryTab: (tab: RegistryTab) => void;
  snapshots: Partial<Record<ExportRegistry, ExportSnapshot>>;
  registerSnapshot: (snapshot: ExportSnapshot) => void;
  clearSnapshot: (registry: ExportRegistry) => void;
}

const EventExportContext = createContext<EventExportContextValue | null>(null);

export function EventExportProvider({ children }: { children: ReactNode }) {
  const [activeRegistryTab, setActiveRegistryTab] =
    useState<RegistryTab | null>(null);
  const [snapshots, setSnapshots] = useState<
    Partial<Record<ExportRegistry, ExportSnapshot>>
  >({});

  const registerSnapshot = useCallback((snapshot: ExportSnapshot) => {
    setSnapshots((prev) => ({ ...prev, [snapshot.registry]: snapshot }));
  }, []);

  const clearSnapshot = useCallback((registry: ExportRegistry) => {
    setSnapshots((prev) => {
      if (!(registry in prev)) return prev;
      const next = { ...prev };
      delete next[registry];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      activeRegistryTab,
      setActiveRegistryTab,
      snapshots,
      registerSnapshot,
      clearSnapshot,
    }),
    [activeRegistryTab, snapshots, registerSnapshot, clearSnapshot],
  );

  return (
    <EventExportContext.Provider value={value}>
      {children}
    </EventExportContext.Provider>
  );
}

function useEventExportContext(): EventExportContextValue {
  const context = useContext(EventExportContext);
  if (!context) {
    throw new Error(
      "useEventExportContext must be used within EventExportProvider",
    );
  }
  return context;
}

export function useRegisterExportSnapshot(snapshot: ExportSnapshot | null) {
  const { registerSnapshot, clearSnapshot } = useEventExportContext();

  useEffect(() => {
    if (!snapshot) return;
    registerSnapshot(snapshot);
    return () => {
      clearSnapshot(snapshot.registry);
    };
  }, [snapshot, registerSnapshot, clearSnapshot]);
}

export function useEventExport() {
  return useEventExportContext();
}
