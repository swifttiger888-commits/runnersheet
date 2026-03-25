"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  filterJourneysByBranch,
  useJourneyData,
} from "@/context/journey-data-context";
import { useSessionBranch } from "@/context/session-branch-context";
import { useBranches } from "@/context/branches-context";
import { buildDailyBranchPdf } from "@/lib/pdf-report";

export default function ManagerReportsPage() {
  const { journeys, loading } = useJourneyData();
  const { managerBranchFilter } = useSessionBranch();
  const { branchNames } = useBranches();
  const [branch, setBranch] = useState("All");
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (branchNames.length === 0) return;
    setBranch((b) =>
      b === "All" || (b && branchNames.includes(b)) ? b : "All",
    );
  }, [branchNames]);

  const date = useMemo(() => new Date(dateStr + "T12:00:00"), [dateStr]);

  const preview = useMemo(() => {
    if (!branch || branchNames.length === 0) {
      return { count: 0, branch: "" };
    }
    const filtered = filterJourneysByBranch(journeys, branch);
    const day = filtered.filter((j) => {
      if (j.status !== "completed" || !j.endTime) return false;
      const t = j.endTime;
      return (
        t.getFullYear() === date.getFullYear() &&
        t.getMonth() === date.getMonth() &&
        t.getDate() === date.getDate()
      );
    });
    return { count: day.length, branch };
  }, [journeys, branch, date, branchNames]);

  async function downloadPdf() {
    if (!branch || branchNames.length === 0) return;
    setBusy(true);
    try {
      const filtered = filterJourneysByBranch(journeys, branch).filter(
        (j) => j.status === "completed" && j.endTime,
      );
      const bytes = await buildDailyBranchPdf({
        branch,
        date,
        journeys: filtered,
      });
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `runnersheet-${branch}-${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManagerPageShell title="Daily reports">
      <p className="text-sm text-muted">
        Branch + date · PDF export (demo uses cloud journey data when in Firebase
        mode; otherwise session demo data).
      </p>

      {loading ? <LoadingScreen label="Loading journeys…" /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch">Branch</Label>
            {branchNames.length === 0 ? (
              <p className="text-sm text-muted">
                No branches configured. Add them under Manage branches.
              </p>
            ) : (
              <select
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground shadow-inset-field"
                id="branch"
                onChange={(e) => setBranch(e.target.value)}
                value={branch}
              >
                <option value="All">All</option>
                {branchNames.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d">Date</Label>
            <Input
              id="d"
              onChange={(e) => setDateStr(e.target.value)}
              type="date"
              value={dateStr}
            />
          </div>
          <p className="text-sm text-muted">
            Preview: {preview.count} completed journeys
            {preview.branch ? ` · ${preview.branch}` : ""}
            {managerBranchFilter !== "All"
              ? ` · dashboard filter: ${managerBranchFilter}`
              : ""}
          </p>
          <Button
            className="gap-2"
            disabled={busy || loading || !branch || branchNames.length === 0}
            onClick={() => void downloadPdf()}
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden />
            Generate PDF
          </Button>
        </div>
      </Card>
    </ManagerPageShell>
  );
}
