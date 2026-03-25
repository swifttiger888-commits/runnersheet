"use client";

import { CheckCircle } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useJourneyData } from "@/context/journey-data-context";

export default function ManagerAlertsPage() {
  const { alerts, loading, resolveAlert } = useJourneyData();

  const open = alerts.filter((a) => !a.isResolved);

  return (
    <ManagerPageShell title="Alerts">
      {loading ? <LoadingScreen /> : null}
      {!loading && open.length === 0 ? (
        <Card className="border-dashed py-10 text-center text-sm text-muted">
          No open alerts.
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((a) => (
            <li key={a.id}>
              <Card className="p-4">
                <p className="text-xs font-bold uppercase text-primary">
                  {a.alertType}
                </p>
                <p className="mt-1 text-sm text-foreground">{a.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.createdAt.toLocaleString("en-GB")}
                </p>
                <Button
                  className="mt-3 gap-2"
                  onClick={() => void resolveAlert(a.id)}
                  type="button"
                  variant="secondary"
                >
                  <CheckCircle className="h-4 w-4" aria-hidden />
                  Resolve
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ManagerPageShell>
  );
}
