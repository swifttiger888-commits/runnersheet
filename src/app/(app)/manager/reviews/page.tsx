"use client";

import { useMemo } from "react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card } from "@/components/ui/card";
import { useJourneyData } from "@/context/journey-data-context";

export default function PendingReviewsPage() {
  const { journeys, loading } = useJourneyData();

  const pending = useMemo(
    () => journeys.filter((j) => j.needsReview && j.isApproved !== true),
    [journeys],
  );

  return (
    <ManagerPageShell title="Pending reviews">
      {loading ? <LoadingScreen /> : null}
      {!loading && pending.length === 0 ? (
        <Card className="border-dashed py-10 text-center text-sm text-muted">
          No journeys pending review.
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((j) => (
            <li key={j.id}>
              <Card className="p-4">
                <p className="font-semibold">{j.vehicleRegistration}</p>
                <p className="text-sm text-muted">{j.driverName}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ManagerPageShell>
  );
}
