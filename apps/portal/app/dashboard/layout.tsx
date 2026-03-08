import { redirect } from "next/navigation";
import React from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
