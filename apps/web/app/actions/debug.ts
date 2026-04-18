"use server";

import { cookies } from "next/headers";

export async function toggleMockMode(enabled: boolean) {
  const cookieStore = await cookies();
  if (enabled) {
    cookieStore.set("debug_mock", "1", { httpOnly: true, sameSite: "lax" });
  } else {
    cookieStore.delete("debug_mock");
  }
}
