"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Mail, RefreshCw } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ensureFirebaseClients } from "@/lib/firebase";

type ManagerRow = {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  homeBranch: string;
};

function ManagersListBody() {
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setLoading(false);
      setError("Firebase not available.");
      return;
    }
    try {
      const { collection, getDocs, query, where } = await import(
        "firebase/firestore"
      );
      const q = query(
        collection(clients.db, "users"),
        where("accessStatus", "==", "approved"),
        where("role", "==", "manager"),
      );
      const snap = await getDocs(q);
      const next: ManagerRow[] = [];
      snap.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        next.push({
          id: d.id,
          name: String(x.name ?? "").trim(),
          email: String(x.email ?? "").trim(),
          employeeId: String(x.employeeId ?? "").trim(),
          homeBranch: String(x.homeBranch ?? "").trim(),
        });
      });
      next.sort((a, b) => a.name.localeCompare(b.name));
      setRows(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load managers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingScreen label="Loading managers…" />;

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <Card className="border-border/80 p-6 text-center text-sm text-muted">
          <Briefcase
            className="mx-auto mb-2 h-9 w-9 text-muted opacity-80"
            aria-hidden
          />
          No approved managers yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id}>
              <Card className="border-border/80 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.name || "—"}</p>
                  {m.email ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{m.email}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    ID {m.employeeId || "—"} · {m.homeBranch || "—"}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => {
          setLoading(true);
          void load();
        }}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Refresh
      </Button>
    </div>
  );
}

export default function ManagerManagementPage() {
  return (
    <ManagerPageShell title="Managers">
      <ManagersListBody />
    </ManagerPageShell>
  );
}
