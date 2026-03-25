"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Home,
  Loader2,
  Mail,
  UserPlus,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ensureFirebaseClients } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useRequireRole } from "@/hooks/use-require-role";

type PendingRow = {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  homeBranch: string;
  requestedAt: Date | null;
};

export default function ManagerApprovalsPage() {
  const { gateOk } = useRequireRole("manager");
  const { user } = useAuth();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      const q = query(
        collection(clients.db, "users"),
        where("accessStatus", "==", "pending"),
        orderBy("requestedAt", "desc"),
      );
      const snap = await getDocs(q);
      const next: PendingRow[] = [];
      snap.forEach((d) => {
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

  async function approve(uid: string) {
    setBusyId(uid);
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { doc, serverTimestamp, updateDoc } = await import(
        "firebase/firestore"
      );
      await updateDoc(doc(clients.db, "users", uid), {
        accessStatus: "approved",
        role: "driver",
        approvedAt: serverTimestamp(),
      });
      setRows((r) => r.filter((x) => x.id !== uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(uid: string) {
    setBusyId(uid);
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(clients.db, "users", uid), {
        accessStatus: "rejected",
      });
      setRows((r) => r.filter((x) => x.id !== uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!gateOk) {
    return (
      <AppShell title="Access requests">
        <LoadingScreen label="Checking access…" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Access requests">
      <p className="-mt-2 mb-4 text-sm text-muted">
        Approve company driver accounts (self-service sign-ups appear here).
      </p>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/manager"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted transition-[background-color,color] duration-200 hover:bg-muted-bg/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to hub
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
      </div>

      {error ? (
        <p className="mb-4 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingScreen label="Loading requests…" />
      ) : rows.length === 0 ? (
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                      onClick={() => void approve(row.id)}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden />
                      )}
                      Approve driver
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busyId !== null}
                      onClick={() => void reject(row.id)}
                    >
                      {busyId === row.id ? (
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
