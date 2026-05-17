import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Gates",
};

export default function GatesPage() {
  redirect("/events");
}
