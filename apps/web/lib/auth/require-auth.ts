"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the current session's access token and a fresh trace ID for use
 * in gate-server calls from server components and server actions.
 *
 * Redirects to /login if there is no valid session — consistent with the
 * dashboard layout guard. Pages never need to handle the unauthenticated case
 * themselves.
 */
export async function requireAuth(): Promise<{
  accessToken: string;
  traceId: string;
}> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  return {
    accessToken: session.access_token,
    traceId: randomUUID(),
  };
}