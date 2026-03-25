"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ClipboardCopy,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJourneyData } from "@/context/journey-data-context";
import { ensureFirebaseClients } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-env";
import { mapJourneyDoc } from "@/lib/firestore-mappers";
import {
  formatNipNominationCopy,
  journeyCoversNipInstant,
} from "@/lib/nip-journey";
import { friendlyFirestoreError } from "@/lib/user-facing-errors";
import {
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";
import { useAuth } from "@/context/auth-context";
import type { JourneyRecord } from "@/types/journey";

function buildNipDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (
    [y, m, d, hh, mm].some((n) => Number.isNaN(n)) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

async function fetchJourneysByPlate(
  regFormatted: string,
): Promise<JourneyRecord[]> {
  const clients = await ensureFirebaseClients();
  if (!clients) return [];
  const { collection, getDocs, query, where } = await import(
    "firebase/firestore"
  );
  const snap = await getDocs(
    query(
      collection(clients.db, "journeys"),
      where("vehicleRegistration", "==", regFormatted),
    ),
  );
  return snap.docs.map((d) =>
    mapJourneyDoc(d.id, d.data() as Record<string, unknown>),
  );
}

export default function ManagerNipLookupPage() {
  const { usesFirebaseAuth } = useAuth();
  const { journeys: demoJourneys } = useJourneyData();
  const [plate, setPlate] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JourneyRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [copyOkId, setCopyOkId] = useState<string | null>(null);

  const canSearch =
    Boolean(plate.trim()) &&
    Boolean(dateStr) &&
    Boolean(timeStr) &&
    (!usesFirebaseAuth || isFirebaseConfigured());

  const nip = useMemo(
    () => buildNipDateTime(dateStr, timeStr),
    [dateStr, timeStr],
  );

  const runSearch = useCallback(async () => {
    setError(null);
    setCopyOkId(null);
    if (!nip) {
      setError("Choose a valid date and time from the notice.");
      return;
    }
    const regFormatted = formatUkVehicleRegistration(plate);
    if (!regFormatted) {
      setError("Enter the vehicle registration (letters and numbers).");
      return;
    }

    setBusy(true);
    setSearched(true);
    try {
      let pool: JourneyRecord[] = [];
      if (usesFirebaseAuth) {
        if (!isFirebaseConfigured()) {
          setError("Cloud sign-in isn’t set up on this device.");
          setResults([]);
          setBusy(false);
          return;
        }
        pool = await fetchJourneysByPlate(regFormatted);
      } else {
        pool = demoJourneys;
      }

      const matches = pool.filter(
        (j) =>
          sanitizeAlphanumericUpper(j.vehicleRegistration) ===
            sanitizeAlphanumericUpper(regFormatted) &&
          journeyCoversNipInstant(j, nip),
      );
      matches.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      setResults(matches);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Search failed.";
      setError(friendlyFirestoreError(raw));
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, [nip, plate, usesFirebaseAuth, demoJourneys]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runSearch();
  }

  async function copyNomination(j: JourneyRecord) {
    if (!nip) return;
    const text = formatNipNominationCopy({ journey: j, nipDateTime: nip });
    try {
      await navigator.clipboard.writeText(text);
      setCopyOkId(j.id);
      window.setTimeout(() => setCopyOkId(null), 2500);
    } catch {
      setError(
        "Couldn’t copy — your browser may block clipboard access. Select the preview text manually.",
      );
    }
  }

  return (
    <ManagerPageShell title="NIP lookup">
      <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm leading-relaxed text-foreground">
        <p className="flex gap-2 font-semibold">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            aria-hidden
          />
          Who was driving at the time on the notice?
        </p>
        <ol className="list-decimal space-y-1.5 pl-6 text-muted">
          <li>
            Enter the <strong className="font-medium text-foreground">registration</strong>{" "}
            exactly as on the vehicle (with or without a space — we’ll match it).
          </li>
          <li>
            Enter the <strong className="font-medium text-foreground">date and time</strong>{" "}
            shown on the notice (alleged offence time).
          </li>
          <li>
            We list journeys where that vehicle was on an active trip at that moment
            (started before, not ended yet — or still running).
          </li>
          <li>
            Use <strong className="font-medium text-foreground">Copy for nomination</strong>{" "}
            to paste plain text into the police portal.
          </li>
        </ol>
        <p className="rounded-lg bg-surface/80 px-3 py-2 text-xs text-muted">
          <span className="font-medium text-foreground">Example:</span> plate{" "}
          <span className="font-mono text-foreground">AB12 CDE</span>, date and time
          taken from the NIP document.
        </p>
      </div>

      <details className="group rounded-xl border border-border bg-muted-bg/25 px-4 py-3 text-sm text-muted">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
          Technical details (for IT)
        </summary>
        <p className="mt-2 pl-6 text-xs leading-relaxed">
          Matches Firestore{" "}
          <code className="rounded bg-muted-bg/80 px-1 font-mono text-[0.7rem] text-foreground">
            journeys
          </code>{" "}
          where{" "}
          <code className="rounded bg-muted-bg/80 px-1 font-mono text-[0.7rem]">
            vehicleRegistration
          </code>{" "}
          equals the formatted plate,{" "}
          <code className="rounded bg-muted-bg/80 px-1 font-mono text-[0.7rem]">
            startTime
          </code>{" "}
          is before the NIP instant, and{" "}
          <code className="rounded bg-muted-bg/80 px-1 font-mono text-[0.7rem]">
            endTime
          </code>{" "}
          is after it or the journey is still{" "}
          <code className="rounded bg-muted-bg/80 px-1 font-mono text-[0.7rem]">
            active
          </code>
          .
        </p>
      </details>

      {!usesFirebaseAuth || !isFirebaseConfigured() ? (
        <p className="rounded-xl border border-border bg-muted-bg/40 px-4 py-3 text-sm text-muted">
          <strong className="font-medium text-foreground">Demo mode:</strong> only
          journeys stored in this browser session are searched. Use your live app
          with cloud sign-in to search the full history.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" aria-hidden />
            Search
          </CardTitle>
        </CardHeader>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nip-plate">Registration plate</Label>
            <Input
              id="nip-plate"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="e.g. AB12 CDE or AB12CDE"
            />
            <p className="text-xs text-muted">
              Paste from the notice if you like — we normalise UK plates.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nip-date">Date on the notice</Label>
              <Input
                id="nip-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nip-time">Time on the notice</Label>
              <Input
                id="nip-time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Date and time use{" "}
            <strong className="font-medium text-foreground">
              this device’s timezone
            </strong>
            . If the notice shows a different zone, convert before searching.
          </p>

          {error ? (
            <p className="rounded-lg border border-danger/35 bg-danger-bg px-3 py-2 text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="gap-2"
            disabled={!canSearch || busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            Search journeys
          </Button>
        </form>
      </Card>

      {searched && !busy ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-base font-bold text-foreground">Results</h2>
          {results.length === 0 ? (
            <Card className="border-dashed p-5 text-sm">
              <p className="font-medium text-foreground">
                No journey matched that plate and time.
              </p>
              <p className="mt-2 text-muted">Try the following:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
                <li>
                  Check the registration — try with and without a space (
                  <span className="font-mono text-foreground">AB12 CDE</span> vs{" "}
                  <span className="font-mono text-foreground">AB12CDE</span>).
                </li>
                <li>
                  Confirm the date and time match the notice (including AM/PM if
                  you converted manually).
                </li>
                <li>
                  The trip might be outside the history we can load (very old
                  journeys may not appear in the search).
                </li>
                <li>
                  Another vehicle or a private trip wouldn’t appear in RunnerSheet.
                </li>
              </ul>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((j) => {
                const preview =
                  nip != null
                    ? formatNipNominationCopy({ journey: j, nipDateTime: nip })
                    : "";
                return (
                  <li key={j.id}>
                    <Card className="border-border/80 p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1 text-sm">
                            <p className="font-semibold text-foreground">
                              {j.driverName}
                            </p>
                            <p className="text-muted">
                              Employee ID:{" "}
                              <span className="font-mono text-foreground">
                                {j.driverId || "—"}
                              </span>
                            </p>
                            <p className="text-muted">
                              Home branch: {j.homeBranch || "—"}
                            </p>
                            <p className="text-muted">
                              Certified vehicle:{" "}
                              <span className="text-foreground">
                                {[
                                  j.certifiedVehicleMake,
                                  j.certifiedVehicleModel,
                                ]
                                  .filter((v): v is string => Boolean(v && v.trim()))
                                  .join(" ") || "—"}
                              </span>
                              {j.certifiedVehicleColor ? (
                                <>
                                  {" "}
                                  ·{" "}
                                  <span className="text-foreground">
                                    {j.certifiedVehicleColor}
                                  </span>
                                </>
                              ) : null}
                            </p>
                            <p className="text-muted">
                              Start odometer:{" "}
                              <span className="tabular-nums text-foreground">
                                {j.startingMileage}
                              </span>{" "}
                              mi · End odometer:{" "}
                              <span className="tabular-nums text-foreground">
                                {j.endingMileage != null
                                  ? j.endingMileage
                                  : "—"}
                              </span>{" "}
                              mi
                            </p>
                            <p className="text-xs text-muted">
                              Journey{" "}
                              {j.status === "active" ? "active" : "completed"} ·
                              Started{" "}
                              {j.startTime.toLocaleString("en-GB", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                              {j.endTime
                                ? ` · Ended ${j.endTime.toLocaleString("en-GB", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}`
                                : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            className="shrink-0 gap-2"
                            onClick={() => void copyNomination(j)}
                          >
                            <ClipboardCopy className="h-4 w-4" aria-hidden />
                            {copyOkId === j.id
                              ? "Copied to clipboard"
                              : "Copy for nomination"}
                          </Button>
                        </div>

                        <details className="rounded-xl border border-border/80 bg-muted-bg/30">
                          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                            <span className="inline-flex items-center gap-2">
                              <ChevronDown
                                className="h-4 w-4 shrink-0 text-muted transition-transform [details[open]_&]:rotate-180"
                                aria-hidden
                              />
                              Preview text before copying
                            </span>
                          </summary>
                          <pre
                            className="max-h-64 overflow-auto border-t border-border/80 px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground wrap-break-word"
                            tabIndex={0}
                          >
                            {preview}
                          </pre>
                        </details>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </ManagerPageShell>
  );
}
