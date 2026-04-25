"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Car,
  CirclePlus,
  ClipboardList,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BranchSelector } from "@/components/branch-selector";
import { LoadingScreen } from "@/components/loading-screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  filterJourneysByBranch,
  useJourneyData,
} from "@/context/journey-data-context";
import { useSessionBranch } from "@/context/session-branch-context";
import { useRequireRole } from "@/hooks/use-require-role";
import { ensureFirebaseClients } from "@/lib/firebase";

/** Small count pill for quick actions (only when count &gt; 0). */
function NavBadge({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  if (count <= 0) return null;
  const shown = count > 99 ? "99+" : String(count);
  return (
    <span
      className="ml-auto inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold tabular-nums leading-none text-primary-foreground"
      aria-label={`${label}: ${count}`}
    >
      {shown}
    </span>
  );
}

const quick = [
  { href: "/manager/approvals", label: "Access requests", icon: UserPlus },
  { href: "/manager/branches", label: "Manage branches", icon: Building2 },
  { href: "/manager/journeys", label: "All journeys", icon: Car },
  { href: "/manager/nip-lookup", label: "NIP lookup", icon: Search },
  { href: "/manager/reviews", label: "Pending reviews", icon: ClipboardList },
  { href: "/manager/alerts", label: "Alerts", icon: AlertTriangle },
  {
    href: "/manager/drivers",
    label: "Drivers & app installs",
    icon: Users,
  },
  { href: "/manager/drivers/add", label: "Add team member", icon: CirclePlus },
  { href: "/manager/reports", label: "Reports (PDF)", icon: FileText },
] as const;

export default function ManagerDashboardPage() {
  const { gateOk } = useRequireRole("manager");
  const { user, profile, signOutUser } = useAuth();
  const { managerBranchFilter, setManagerBranchFilter } = useSessionBranch();
  const { journeys, alerts, loading, error } = useJourneyData();
  const [pendingAccessCount, setPendingAccessCount] = useState(0);

  const filtered = useMemo(
    () => filterJourneysByBranch(journeys, managerBranchFilter),
    [journeys, managerBranchFilter],
  );

  const activeList = useMemo(
    () => filtered.filter((j) => j.status === "active"),
    [filtered],
  );

  const unresolvedAlerts = useMemo(
    () => alerts.filter((a) => !a.isResolved),
    [alerts],
  );

  const branchFilteredAlerts = useMemo(() => {
    if (managerBranchFilter === "All") return unresolvedAlerts;
    return unresolvedAlerts.filter((a) => {
      const j = journeys.find((x) => x.id === a.journeyId);
      return j?.homeBranch === managerBranchFilter;
    });
  }, [unresolvedAlerts, journeys, managerBranchFilter]);

  const pendingReviews = useMemo(
    () =>
      filtered.filter((j) => j.needsReview && j.isApproved !== true).length,
    [filtered],
  );

  useEffect(() => {
    if (!gateOk || !profile) return;
    let cancelled = false;
    void (async () => {
      const clients = await ensureFirebaseClients();
      if (!clients || cancelled) return;
      try {
        const { collection, getCountFromServer, query, where } = await import(
          "firebase/firestore"
        );
        const q = query(
          collection(clients.db, "users"),
          where("accessStatus", "==", "pending"),
        );
        const snap = await getCountFromServer(q);
        if (!cancelled) setPendingAccessCount(snap.data().count);
      } catch {
        if (!cancelled) setPendingAccessCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateOk, profile]);

  const navBadgeCounts = useMemo(
    () =>
      ({
        "/manager/approvals": pendingAccessCount,
        "/manager/journeys": activeList.length,
        "/manager/reviews": pendingReviews,
        "/manager/alerts": branchFilteredAlerts.length,
      }) as Record<string, number>,
    [
      pendingAccessCount,
      activeList.length,
      pendingReviews,
      branchFilteredAlerts.length,
    ],
  );

  const navBadgeLabel = useMemo(
    () =>
      ({
        "/manager/approvals": "Pending access requests",
        "/manager/journeys": "Live journeys",
        "/manager/reviews": "Pending reviews",
        "/manager/alerts": "Unresolved alerts",
      }) as Record<string, string>,
    [],
  );

  if (!gateOk) {
    return (
      <AppShell showBrand>
        <LoadingScreen label="Checking session…" />
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell showBrand title="Manager">
        <p className="text-sm text-muted">
          Add a Firestore <code className="font-mono text-xs">users/{user?.uid}</code>{" "}
          document with role manager plus name, employeeId, homeBranch.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell showBrand title="Manager">
        <LoadingScreen label="Loading data…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      showBrand
      title={`${profile.name}`}
      actions={
        <Button
          variant="ghost"
          className="min-h-10 gap-1.5 px-3 text-xs font-semibold"
          onClick={() => void signOutUser()}
          type="button"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      }
    >
      <p className="text-sm text-muted">Manager dashboard · real-time overview</p>

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger shadow-card-quiet">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-bold text-foreground">{activeList.length}</p>
          <p className="text-xs font-medium text-muted">Active</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-bold text-foreground">
            {branchFilteredAlerts.length}
          </p>
          <p className="text-xs font-medium text-muted">Alerts</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="text-2xl font-bold text-foreground">{pendingReviews}</p>
          <p className="text-xs font-medium text-muted">Reviews</p>
        </Card>
      </div>

      <BranchSelector
        mode="manager"
        value={managerBranchFilter}
        onChange={setManagerBranchFilter}
      />

      <div>
        <h2 className="mb-2 flex flex-wrap items-center gap-2 text-base font-bold text-foreground">
          <LayoutGrid className="h-5 w-5 text-primary" aria-hidden />
          Active journeys
          {activeList.length > 0 ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
              {activeList.length} live
            </span>
          ) : null}
        </h2>
        {activeList.length === 0 ? (
          <Card className="border-dashed py-8 text-center text-sm text-muted">
            No active journeys for this filter.
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeList.map((j) => (
              <li key={j.id}>
                <Card className="p-4">
                  <p className="font-semibold">
                    {j.driverName} · {j.vehicleRegistration}
                  </p>
                  <p className="text-sm text-muted">
                    {j.journeyType} · {j.homeBranch} · started{" "}
                    {j.startTime.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          Quick actions
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {quick.map(({ href, label, icon: Icon }) => {
            const count = navBadgeCounts[href] ?? 0;
            const badgeLabel = navBadgeLabel[href] ?? label;
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-card-quiet transition-colors hover:bg-muted-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 text-left leading-snug">{label}</span>
                <NavBadge count={count} label={badgeLabel} />
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        <Link
          className="inline-flex items-center justify-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          href="/"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          Home
        </Link>
      </p>
    </AppShell>
  );
}
