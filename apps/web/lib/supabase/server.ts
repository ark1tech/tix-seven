import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function isMockMode(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_DEBUG_TOOLS !== "true") return false;
  const cookieStore = await cookies();
  return cookieStore.get("debug_mock")?.value === "1";
}

export async function createClient() {
  const cookieStore = await cookies();
  const mock =
    process.env.NEXT_PUBLIC_DEBUG_TOOLS === "true" &&
    cookieStore.get("debug_mock")?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(mock ? { db: { schema: "mock" } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  );
}
