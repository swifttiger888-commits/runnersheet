"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Mail, RefreshCw } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { DriverAppBadge } from "@/components/driver-app-badge";
import { LoadingScreen } from "@/components/loading-screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  computeAppAdoptionPercent,
  fetchApprovedDrivers,
  type ApprovedDriverRow,
} from "@/lib/fetch-approved-drivers";
import { ensureFirebaseClients } from "@/lib/firebase";

function DriversListBody() {
  const [drivers, setDrivers] = useState<ApprovedDriverRow[]>([]);
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
      const list = await fetchApprovedDrivers(clients.db);
      setDrivers(list);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load drivers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const adoptionPct = computeAppAdoptionPercent(drivers);

  if (loading) {
    return <LoadingScreen label="Loading drivers…" />;
  }

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
      <div className="rounded-xl border border-border/80 bg-surface-elevated/60 px-4 py-3 shadow-card-quiet">
        <p className="text-sm text-foreground">
          <span className="text-muted">App Adoption: </span>
          <span className="font-semibold tabular-nums text-foreground">
            {adoptionPct === null ? "—" : `${adoptionPct}%`}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Share of approved drivers who use the home screen app (
          {drivers.filter((d) => d.isInstalled).length} of {drivers.length}).
        </p>
      </div>

      {drivers.length === 0 ? (
        <Card className="border-border/80 p-6 text-center text-sm text-muted">
          <Car
            className="mx-auto mb-2 h-9 w-9 text-muted opacity-80"
            aria-hidden
          />
          No approved drivers in Firestore yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {drivers.map((d) => (
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

export default function DriverManagementPage() {
  return (
    <ManagerPageShell title="Drivers">
      <DriversListBody />
    </ManagerPageShell>
  );
}
