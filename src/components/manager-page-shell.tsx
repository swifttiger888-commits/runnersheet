"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { useRequireRole } from "@/hooks/use-require-role";

type ManagerPageShellProps = {
  title: string;
  children: ReactNode;
  /** Show “Back to manager dashboard” link (default true). */
  showBackLink?: boolean;
};

export function ManagerPageShell({
  title,
  children,
  showBackLink = true,
}: ManagerPageShellProps) {
  const { gateOk } = useRequireRole("manager");

  if (!gateOk) {
    return (
      <AppShell showBrand>
        <LoadingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell showBrand title={title}>
      {children}
      {showBackLink ? (
        <p className="text-center text-sm">
          <Link
            className="inline-flex items-center justify-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
            href="/manager"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
            Back to manager dashboard
          </Link>
        </p>
      ) : null}
    </AppShell>
  );
}
