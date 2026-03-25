"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Car,
  Clock,
  Home,
  Loader2,
  LogOut,
  Mail,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { DriverAppBadge } from "@/components/driver-app-badge";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  computeAppAdoptionPercent,
  fetchApprovedDrivers,
  type ApprovedDriverRow,
} from "@/lib/fetch-approved-drivers";
import { ensureFirebaseClients } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useRequireRole } from "@/hooks/use-require-role";
import type { UserRole } from "@/types/user";

type PendingRow = {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  homeBranch: string;
  requestedAt: Date | null;
};

export default function SuperAdminMasterPage() {
  const { gateOk } = useRequireRole("super-admin");
  const { user, signOutUser } = useAuth();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [driverRows, setDriverRows] = useState<ApprovedDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setLoading(false);
      setError("Firebase not available.");
      return;
    }
    try {
      const { collection, getDocs, orderBy, query, where } = await import(
        "firebase/firestore"
      );
      const qPending = query(
        collection(clients.db, "users"),
        where("accessStatus", "==", "pending"),
        orderBy("requestedAt", "desc"),
      );
      const [pendingSnap, drivers] = await Promise.all([
        getDocs(qPending),
        fetchApprovedDrivers(clients.db),
      ]);
      setDriverRows(drivers);
      const next: PendingRow[] = [];
      pendingSnap.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        const ts = x.requestedAt;
        let requestedAt: Date | null = null;
        if (
          ts &&
          typeof ts === "object" &&
          "toDate" in ts &&
          typeof (ts as { toDate: () => Date }).toDate === "function"
        ) {
          requestedAt = (ts as { toDate: () => Date }).toDate();
        }
        next.push({
          id: d.id,
          name: String(x.name ?? ""),
          email: String(x.email ?? ""),
          employeeId: String(x.employeeId ?? ""),
          homeBranch: String(x.homeBranch ?? ""),
          requestedAt,
        });
      });
      setRows(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load pending requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gateOk) void load();
  }, [gateOk, load]);

  async function approve(uid: string, assignRole: Exclude<UserRole, "super-admin">) {
    const actionKey = `${uid}-${assignRole}`;
    setBusyId(uid);
    setBusyAction(actionKey);
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { doc, serverTimestamp, updateDoc } = await import(
        "firebase/firestore"
      );
      await updateDoc(doc(clients.db, "users", uid), {
        accessStatus: "approved",
        role: assignRole,
        approvedAt: serverTimestamp(),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function reject(uid: string) {
    setBusyId(uid);
    setBusyAction(`${uid}-reject`);
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(clients.db, "users", uid), {
        accessStatus: "rejected",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  if (!gateOk) {
    return (
      <AppShell title="Super Admin">
        <LoadingScreen label="Checking access…" />
      </AppShell>
    );
  }

  const adoptionPct = computeAppAdoptionPercent(driverRows);

  return (
    <AppShell title="Super Admin">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 text-sm text-foreground">
          <p className="font-semibold">Master dashboard</p>
          <p className="mt-1 text-muted">
            Signed in with Google. Approve Arnold Clark access requests as
            driver or manager — no separate password.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted transition-[background-color,color] duration-200 hover:bg-muted-bg/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>
        <Button
          variant="secondary"
          className="gap-2"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Clock className="h-4 w-4" aria-hidden />
          )}
          Refresh
        </Button>
        <Button
          variant="ghost"
          className="gap-2"
          type="button"
          onClick={() => void signOutUser()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </div>

      {error ? (
        <p className="mb-4 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingScreen label="Loading dashboard…" />
      ) : (
        <>
          <div className="mb-6 rounded-xl border border-border/80 bg-surface-elevated/60 px-4 py-3 shadow-card-quiet">
            <p className="text-sm text-foreground">
              <span className="text-muted">App Adoption: </span>
              <span className="font-semibold tabular-nums text-foreground">
                {adoptionPct === null ? "—" : `${adoptionPct}%`}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Share of approved drivers who use the home screen app (
              {driverRows.filter((d) => d.isInstalled).length} of{" "}
              {driverRows.length}).
            </p>
          </div>

          <div className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Drivers
            </h2>
            {driverRows.length === 0 ? (
              <Card className="border-border/80 p-6 text-center text-sm text-muted">
                <Car
                  className="mx-auto mb-2 h-9 w-9 text-muted opacity-80"
                  aria-hidden
                />
                No approved drivers yet.
              </Card>
            ) : (
              <ul className="space-y-2">
                {driverRows.map((d) => (
                  <li key={d.id}>
                    <Card className="border-border/80 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">
                              {d.name || "—"}
                            </span>
                            <DriverAppBadge isInstalled={d.isInstalled} />
                          </div>
                          {d.email ? (
                            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{d.email}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Pending access
          </h2>
          {rows.length === 0 ? (
            <Card className="border-border/80 p-6 text-center text-sm text-muted">
              <UserPlus
                className="mx-auto mb-2 h-10 w-10 text-muted opacity-80"
                aria-hidden
              />
              No pending access requests.
            </Card>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <Card className="border-border/80 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">{row.name}</p>
                        <p className="flex items-center gap-2 text-sm text-muted">
                          <Mail className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">{row.email}</span>
                        </p>
                        <p className="text-xs text-muted">
                          ID {row.employeeId || "—"} · {row.homeBranch}
                          {row.requestedAt
                            ? ` · Requested ${row.requestedAt.toLocaleString()}`
                            : ""}
                        </p>
                        {row.id === user?.uid ? (
                          <p className="text-xs text-muted">(your own test row)</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-2"
                          disabled={busyId !== null}
                          onClick={() => void approve(row.id, "driver")}
                        >
                          {busyAction === `${row.id}-driver` ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Car className="h-4 w-4" aria-hidden />
                          )}
                          Approve as driver
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busyId !== null}
                          onClick={() => void approve(row.id, "manager")}
                        >
                          {busyAction === `${row.id}-manager` ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Briefcase className="h-4 w-4" aria-hidden />
                          )}
                          Approve as manager
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busyId !== null}
                          onClick={() => void reject(row.id)}
                        >
                          {busyAction === `${row.id}-reject` ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <X className="h-4 w-4" aria-hidden />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-8 text-center text-sm text-muted">
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
