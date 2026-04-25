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
import { buildDriverJourneyPdf } from "@/lib/pdf-report";

export default function ManagerReportsPage() {
  const { journeys, loading } = useJourneyData();
  const { managerBranchFilter } = useSessionBranch();
  const { branchNames } = useBranches();
  const [branch, setBranch] = useState("Leeds");
  const [fromDateStr, setFromDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [toDateStr, setToDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [driverName, setDriverName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (branchNames.length === 0) return;
    setBranch((b) =>
      b && branchNames.includes(b) ? b : branchNames[0] ?? "Leeds",
    );
  }, [branchNames]);

  const fromDate = useMemo(() => new Date(`${fromDateStr}T00:00:00`), [fromDateStr]);
  const toDate = useMemo(() => new Date(`${toDateStr}T23:59:59`), [toDateStr]);
  const invalidDateRange = fromDate > toDate;

  const driverNames = useMemo(() => {
    const set = new Set<string>();
    for (const j of journeys) {
      if (j.homeBranch !== branch) continue;
      if (!j.driverName?.trim()) continue;
      set.add(j.driverName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [journeys, branch]);

  useEffect(() => {
    if (driverNames.length === 0) {
      setDriverName("");
      return;
    }
    setDriverName((prev) =>
      prev && driverNames.includes(prev) ? prev : driverNames[0],
    );
  }, [driverNames]);

  const preview = useMemo(() => {
    if (!branch || !driverName || branchNames.length === 0) {
      return { count: 0, branch: "", driverName: "" };
    }
    const filtered = filterJourneysByBranch(journeys, branch).filter((j) => {
      if (j.driverName !== driverName) return false;
      if (j.status !== "completed" || !j.endTime) return false;
      return j.endTime >= fromDate && j.endTime <= toDate;
    });
    return { count: filtered.length, branch, driverName };
  }, [journeys, branch, driverName, fromDate, toDate, branchNames]);

  async function downloadPdf() {
    if (!branch || !driverName || branchNames.length === 0 || invalidDateRange) return;
    setBusy(true);
    try {
      const filtered = filterJourneysByBranch(journeys, branch).filter(
        (j) =>
          j.status === "completed" &&
          j.endTime &&
          j.driverName === driverName &&
          j.endTime >= fromDate &&
          j.endTime <= toDate,
      );
      const bytes = await buildDriverJourneyPdf({
        branch,
        driverName,
        fromDate,
        toDate,
        journeys: filtered,
      });
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeDriver = driverName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.download = `runnersheet-${branch}-${safeDriver}-${fromDateStr}-to-${toDateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManagerPageShell title="Daily reports">
      <p className="text-sm text-muted">
        Driver-specific A4 PDF export in table format (newest first). Use for
        hard-copy records.
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
                {branchNames.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="driver">Driver</Label>
            {driverNames.length === 0 ? (
              <p className="text-sm text-muted">
                No drivers with journeys found for this branch yet.
              </p>
            ) : (
              <select
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground shadow-inset-field"
                id="driver"
                onChange={(e) => setDriverName(e.target.value)}
                value={driverName}
              >
                {driverNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from-date">From date</Label>
              <Input
                id="from-date"
                onChange={(e) => setFromDateStr(e.target.value)}
                type="date"
                value={fromDateStr}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to-date">To date</Label>
              <Input
                id="to-date"
                onChange={(e) => setToDateStr(e.target.value)}
                type="date"
                value={toDateStr}
              />
            </div>
          </div>
          <p className="text-sm text-muted">
            Preview: {preview.count} completed journeys
            {preview.driverName ? ` · ${preview.driverName}` : ""}
            {preview.branch ? ` · ${preview.branch}` : ""}
            {managerBranchFilter !== "All"
              ? ` · dashboard filter: ${managerBranchFilter}`
              : ""}
          </p>
          {invalidDateRange ? (
            <p className="text-sm font-medium text-danger">
              From date must be on or before To date.
            </p>
          ) : null}
          <p className="text-xs text-muted">
            PDF header includes driver name, branch, date range, generated time, and
            tabular journey rows for A4 printing.
          </p>
          <Button
            className="gap-2"
            disabled={
              busy ||
              loading ||
              !branch ||
              !driverName ||
              branchNames.length === 0 ||
              driverNames.length === 0 ||
              invalidDateRange
            }
            onClick={() => void downloadPdf()}
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden />
            Generate driver PDF
          </Button>
        </div>
      </Card>
    </ManagerPageShell>
  );
}
