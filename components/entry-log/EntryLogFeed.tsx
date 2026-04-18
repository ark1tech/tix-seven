"use client";

import { useEffect, useState } from "react";
import { subscribeToEntryLogs } from "@/lib/db/entry-logs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EntryLog } from "@/types";

const DENIAL_LABELS: Record<string, string> = {
  invalid_id: "Invalid ID",
  no_ticket: "No Ticket",
  already_used: "Already Used",
  wrong_event: "Wrong Event",
};

interface Props {
  eventId: string;
  initialLogs: EntryLog[];
}

export default function EntryLogFeed({ eventId, initialLogs }: Props) {
  const [logs, setLogs] = useState<EntryLog[]>(initialLogs);

  useEffect(() => {
    const unsub = subscribeToEntryLogs(eventId, (newLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });
    return unsub;
  }, [eventId]);

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scan attempts yet. Waiting for gate activity…
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>UIN Hash</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(log.timestamp).toLocaleTimeString()}
            </TableCell>
            <TableCell>
              <Badge variant={log.result === "grant" ? "default" : "destructive"}>
                {log.result === "grant" ? "Granted" : "Denied"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {log.denial_reason ? DENIAL_LABELS[log.denial_reason] ?? log.denial_reason : "—"}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {log.uin_hash.slice(0, 12)}…
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
