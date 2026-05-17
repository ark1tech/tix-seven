"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface EventHeaderActionsContextValue {
  actions: ReactNode;
  registerActions: (actions: ReactNode) => void;
}

const EventHeaderActionsContext =
  createContext<EventHeaderActionsContextValue | null>(null);

export function EventHeaderActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [actions, setActions] = useState<ReactNode>(null);
  const registerActionsRef = useRef(setActions);
  registerActionsRef.current = setActions;

  const registerActions = useMemo(
    () => (nextActions: ReactNode) => {
      registerActionsRef.current(nextActions);
    },
    [],
  );

  const value = useMemo(
    () => ({
      actions,
      registerActions,
    }),
    [actions, registerActions],
  );

  return (
    <EventHeaderActionsContext.Provider value={value}>
      {children}
    </EventHeaderActionsContext.Provider>
  );
}

export function useEventHeaderActions(): ReactNode {
  const context = useContext(EventHeaderActionsContext);
  return context?.actions ?? null;
}

export function EventHeaderActions({ children }: { children: ReactNode }) {
  const context = useContext(EventHeaderActionsContext);

  useEffect(() => {
    if (!context) return;
    context.registerActions(children);
    return () => {
      context.registerActions(null);
    };
  }, [children, context?.registerActions]);

  return null;
}
