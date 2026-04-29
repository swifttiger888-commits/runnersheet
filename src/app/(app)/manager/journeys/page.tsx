"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useJourneyData } from "@/context/journey-data-context";
import { getAuthHeader } from "@/lib/client-auth";
import { ensureFirebaseClients } from "@/lib/firebase";
import { normalizeJourneyRecord } from "@/lib/normalize-records";
import type { JourneyRecord } from "@/types/journey";
type AiFilters = {
  vehicleRegistration?: string;
  driverId?: string;
  homeBranch?: string;
  status?: "active" | "completed";
  journeyType?: "Delivery" | "Collection" | "Runner";
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
};

type AiIntent = {
  kind: "journeys";
  filters: AiFilters;
  needsDisambiguation: boolean;
  confidence: number;
  interpretation: string;
};

type LocalSensitiveMatches = {
  redactedText: string;
  matchedDriverNames: string[];
  matchedDriverIds: string[];
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterManagerJourneysLocal(
  rows: JourneyRecord[],
  needle: string,
): JourneyRecord[] {
  const s = needle.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter(
    (j) =>
      j.vehicleRegistration.toLowerCase().includes(s) ||
      j.driverName.toLowerCase().includes(s) ||
      j.driverId.toLowerCase().includes(s) ||
      j.homeBranch.toLowerCase().includes(s) ||
      (j.certifiedVehicleMake ?? "").toLowerCase().includes(s) ||
      (j.certifiedVehicleModel ?? "").toLowerCase().includes(s) ||
      (j.certifiedVehicleColor ?? "").toLowerCase().includes(s),
  );
}

function buildActiveFilterChips(
  filters: AiFilters,
  localDriverNames: string[],
): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (filters.vehicleRegistration?.trim()) {
    chips.push({ key: "reg", label: `Plate ${filters.vehicleRegistration.trim()}` });
  }
  if (filters.homeBranch?.trim()) {
    chips.push({ key: "branch", label: `Branch ${filters.homeBranch.trim()}` });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label: filters.status === "active" ? "Active only" : "Completed only",
    });
  }
  if (filters.journeyType) {
    chips.push({ key: "type", label: filters.journeyType });
  }
  if (filters.vehicleMake?.trim()) {
    chips.push({ key: "make", label: `Make ${filters.vehicleMake.trim()}` });
  }
  if (filters.vehicleModel?.trim()) {
    chips.push({ key: "model", label: `Model ${filters.vehicleModel.trim()}` });
  }
  if (filters.vehicleColor?.trim()) {
    chips.push({ key: "color", label: `Colour ${filters.vehicleColor.trim()}` });
  }
  if (filters.driverId?.trim()) {
    chips.push({ key: "emp", label: `ID ${filters.driverId.trim()}` });
  }
  for (const name of localDriverNames) {
    const n = name.trim();
    if (n) chips.push({ key: `drv-${n}`, label: `Driver contains “${n}” (local)` });
  }
  return chips;
}

export default function ManagerAllJourneysPage() {
  const { usesFirebaseAuth } = useAuth();
  const { journeys, loading } = useJourneyData();
  const [q, setQ] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIntent, setAiIntent] = useState<AiIntent | null>(null);
  const [aiRows, setAiRows] = useState<JourneyRecord[] | null>(null);
  const [didYouMeanRegs, setDidYouMeanRegs] = useState<string[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** Last successful Magic Search — drives filter chips when Firestore path ran */
  const [activeFilterMeta, setActiveFilterMeta] = useState<{
    filters: AiFilters;
    localDriverNames: string[];
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setVoiceSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const localFiltered = useMemo(
    () => filterManagerJourneysLocal(journeys, q),
    [journeys, q],
  );

  const localDriverNames = useMemo(
    () =>
      Array.from(
        new Set(
          journeys
            .map((j) => j.driverName.trim())
            .filter((v) => v.length >= 3),
        ),
      ),
    [journeys],
  );

  const localDriverIds = useMemo(
    () =>
      Array.from(
        new Set(
          journeys
            .map((j) => j.driverId.trim())
            .filter((v) => v.length >= 2),
        ),
      ),
    [journeys],
  );

  const redactSensitiveTerms = useCallback((text: string): LocalSensitiveMatches => {
    const matchedDriverNames = localDriverNames.filter((name) =>
      text.toLowerCase().includes(name.toLowerCase()),
    );
    const matchedDriverIds = localDriverIds.filter((id) =>
      text.toLowerCase().includes(id.toLowerCase()),
    );
    let redactedText = text;
    for (const name of matchedDriverNames) {
      redactedText = redactedText.replace(
        new RegExp(escapeRegExp(name), "ig"),
        "[DRIVER_NAME]",
      );
    }
    for (const id of matchedDriverIds) {
      redactedText = redactedText.replace(
        new RegExp(escapeRegExp(id), "ig"),
        "[DRIVER_ID]",
      );
    }
    return { redactedText, matchedDriverNames, matchedDriverIds };
  }, [localDriverNames, localDriverIds]);

  const runFirestoreMagicSearch = useCallback(async (
    filters: AiFilters,
    localMatches: LocalSensitiveMatches,
  ) => {
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setAiRows(localFiltered);
      return;
    }
    const fs = await import("firebase/firestore");
    const { collection, getDocs, limit, orderBy, query, where } = fs;
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit>> =
      [orderBy("startTime", "desc"), limit(200)];

    if (filters.vehicleRegistration) {
      constraints.push(
        where("vehicleRegistration", "==", filters.vehicleRegistration),
      );
    }
    if (filters.driverId) constraints.push(where("driverId", "==", filters.driverId));
    // Keep Firestore constraints strict/simple to avoid brittle case-sensitive misses.
    if (filters.status) constraints.push(where("status", "==", filters.status));
    if (filters.journeyType) {
      constraints.push(where("journeyType", "==", filters.journeyType));
    }

    const snap = await getDocs(query(collection(clients.db, "journeys"), ...constraints));
    let rows = snap.docs.map((d) =>
      normalizeJourneyRecord(d.id, d.data() as Record<string, unknown>),
    );

    if (localMatches.matchedDriverNames.length > 0) {
      rows = rows.filter((r) =>
        localMatches.matchedDriverNames.some((name) =>
          r.driverName.toLowerCase().includes(name.toLowerCase()),
        ),
      );
    }
    if (localMatches.matchedDriverIds.length > 0) {
      rows = rows.filter((r) =>
        localMatches.matchedDriverIds.some((id) =>
          r.driverId.toLowerCase().includes(id.toLowerCase()),
        ),
      );
    }
    if (filters.homeBranch) {
      const b = filters.homeBranch.toLowerCase();
      rows = rows.filter((r) => r.homeBranch.toLowerCase().includes(b));
    }
    if (filters.vehicleMake) {
      const mk = filters.vehicleMake.toLowerCase();
      rows = rows.filter((r) =>
        (r.certifiedVehicleMake ?? "").toLowerCase().includes(mk),
      );
    }
    if (filters.vehicleModel) {
      const mdl = filters.vehicleModel.toLowerCase();
      rows = rows.filter((r) =>
        (r.certifiedVehicleModel ?? "").toLowerCase().includes(mdl),
      );
    }
    if (filters.vehicleColor) {
      const col = filters.vehicleColor.toLowerCase();
      rows = rows.filter((r) =>
        (r.certifiedVehicleColor ?? "").toLowerCase().includes(col),
      );
    }

    setAiRows(rows);
    const regs = Array.from(new Set(rows.map((r) => r.vehicleRegistration))).filter(
      Boolean,
    );
    const ambiguousVehiclePrompt =
      !filters.vehicleRegistration &&
      Boolean(filters.vehicleMake || filters.vehicleModel || filters.vehicleColor) &&
      regs.length > 1;
    setDidYouMeanRegs(ambiguousVehiclePrompt ? regs.slice(0, 6) : []);
  }, [localFiltered]);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) {
      setAiBusy(false);
      setAiError(null);
      setAiIntent(null);
      setAiRows(null);
      setDidYouMeanRegs([]);
      setActiveFilterMeta(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        setAiBusy(true);
        setAiError(null);
        try {
          const localMatches = redactSensitiveTerms(text);
          const authHeader = await getAuthHeader();
          const res = await fetch("/api/search/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({
              text: localMatches.redactedText,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            intent?: AiIntent;
            error?: string;
            details?: unknown;
          };
          if (!res.ok || !data.intent) {
            const baseMsg = data.error || "Magic Search failed.";
            const detailMsg = data.details
              ? ` [${res.status}] ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
              : ` [${res.status}]`;
            setAiError(baseMsg + detailMsg);
            setAiRows(null);
            setAiIntent(null);
            setDidYouMeanRegs([]);
            setActiveFilterMeta(null);
            return;
          }
          setAiIntent(data.intent);
          setActiveFilterMeta({
            filters: data.intent.filters,
            localDriverNames: localMatches.matchedDriverNames,
          });
          if (!usesFirebaseAuth) {
            setAiRows(localFiltered);
            setDidYouMeanRegs([]);
            return;
          }
          await runFirestoreMagicSearch(data.intent.filters, localMatches);
        } catch {
          setAiError("Could not run Magic Search right now.");
          setAiRows(null);
          setAiIntent(null);
          setDidYouMeanRegs([]);
          setActiveFilterMeta(null);
        } finally {
          setAiBusy(false);
        }
      })();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [q, usesFirebaseAuth, localFiltered, redactSensitiveTerms, runFirestoreMagicSearch]);

  const filtered = aiRows ?? localFiltered;
  const magicActive = q.trim().length >= 3;
  const filterChips = useMemo(() => {
    if (!activeFilterMeta || !magicActive) return [];
    return buildActiveFilterChips(
      activeFilterMeta.filters,
      activeFilterMeta.localDriverNames,
    );
  }, [activeFilterMeta, magicActive]);

  function clearSearch() {
    setQ("");
    setAiError(null);
    setAiIntent(null);
    setAiRows(null);
    setDidYouMeanRegs([]);
    setActiveFilterMeta(null);
  }

  function applyDidYouMean(reg: string) {
    setQ(reg);
  }

  function handleVoiceSearch() {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Voice search is not supported on this device/browser.");
      return;
    }
    setVoiceError(null);
    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (eventRaw: unknown) => {
      const event = eventRaw as {
        results?: ArrayLike<{
          0?: { transcript?: string };
        }>;
      };
      const first = event.results?.[0]?.[0]?.transcript?.trim();
      if (first) setQ(first);
    };
    rec.onerror = () => {
      setVoiceError("Could not capture voice input. Please try again.");
      setVoiceListening(false);
    };
    rec.onend = () => {
      setVoiceListening(false);
    };
    setVoiceListening(true);
    try {
      rec.start();
    } catch {
      setVoiceListening(false);
      setVoiceError("Voice search could not start on this device.");
    }
  }

  return (
    <ManagerPageShell title="All journeys">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface-elevated/30 p-4 shadow-card-quiet">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="search">Search all journeys</Label>
            <Input
              id="search"
              onChange={(e) => setQ(e.target.value)}
              placeholder="Plate, driver, branch — or try “white Renault Leeds”"
              value={q}
              aria-describedby="search-hint"
            />
          </div>
          {q.trim() ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 shrink-0 gap-1.5 px-3 text-xs"
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
        <p id="search-hint" className="text-xs text-muted">
          Under 3 characters: filters the list already loaded in your browser. 3+
          characters: Magic Search asks the AI for filters, then queries Firestore.
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Magic Search understands plain English (e.g. &quot;white Renault from Leeds this week&quot;).
          </p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 min-w-9 px-2"
            onClick={handleVoiceSearch}
            disabled={!voiceSupported || voiceListening}
            aria-label={voiceListening ? "Listening for voice search" : "Start voice search"}
            title={
              voiceSupported
                ? "Voice search"
                : "Voice search not supported on this browser"
            }
          >
            {voiceListening ? (
              <MicOff className="h-4 w-4 text-primary" aria-hidden />
            ) : (
              <Mic className="h-4 w-4 text-primary" aria-hidden />
            )}
          </Button>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          Privacy shield: driver names/IDs are matched locally and redacted before AI.
        </p>
        {voiceListening ? (
          <p className="text-xs text-muted">Listening… speak your search now.</p>
        ) : null}
        {voiceError ? (
          <p className="text-xs text-danger" role="alert">
            {voiceError}
          </p>
        ) : null}
        {aiBusy ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Translating search and querying office…
          </p>
        ) : null}
        {aiIntent && magicActive && !aiBusy ? (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted-bg/25 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">
              {aiIntent.interpretation}
            </p>
            {typeof aiIntent.confidence === "number" ? (
              <p className="text-[11px] text-muted">
                Confidence{" "}
                {Math.round(Math.min(1, Math.max(0, aiIntent.confidence)) * 100)}
                %
              </p>
            ) : null}
            {filterChips.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Active filters
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Active search filters">
                  {filterChips.map((c) => (
                    <li
                      key={c.key}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground"
                    >
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                No structured filters — showing the broadest match we could load.
                Try naming a branch, colour, or registration.
              </p>
            )}
          </div>
        ) : null}
        {aiError ? (
          <div
            className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger-bg px-3 py-2.5"
            role="alert"
          >
            <p className="text-xs text-danger">{aiError}</p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 w-fit gap-1.5 self-start text-xs"
              onClick={() => {
                const t = q.trim();
                if (t.length < 3) return;
                setAiError(null);
                setAiBusy(true);
                void (async () => {
                  try {
                    const localMatches = redactSensitiveTerms(t);
                    const authHeader = await getAuthHeader();
                    const res = await fetch("/api/search/ai", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...authHeader },
                      body: JSON.stringify({
                        text: localMatches.redactedText,
                      }),
                    });
                    const data = (await res.json().catch(() => ({}))) as {
                      intent?: AiIntent;
                      error?: string;
                      details?: unknown;
                    };
                    if (!res.ok || !data.intent) {
                      const baseMsg = data.error || "Magic Search failed.";
                      const detailMsg = data.details
                        ? ` [${res.status}] ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}`
                        : ` [${res.status}]`;
                      setAiError(baseMsg + detailMsg);
                      setAiRows(null);
                      setAiIntent(null);
                      setActiveFilterMeta(null);
                      return;
                    }
                    setAiIntent(data.intent);
                    setActiveFilterMeta({
                      filters: data.intent.filters,
                      localDriverNames: localMatches.matchedDriverNames,
                    });
                    if (!usesFirebaseAuth) {
                      setAiRows(filterManagerJourneysLocal(journeys, t));
                      setDidYouMeanRegs([]);
                      return;
                    }
                    await runFirestoreMagicSearch(data.intent.filters, localMatches);
                  } catch {
                    setAiError("Could not run Magic Search right now.");
                    setActiveFilterMeta(null);
                  } finally {
                    setAiBusy(false);
                  }
                })();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Retry Magic Search
            </Button>
          </div>
        ) : null}
        {didYouMeanRegs.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted">Did you mean:</p>
            {didYouMeanRegs.map((reg) => (
              <Button
                key={reg}
                className="min-h-9 px-3 text-xs"
                onClick={() => applyDidYouMean(reg)}
                type="button"
                variant="secondary"
              >
                {reg}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? <LoadingScreen /> : null}
      {!loading && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <p>
              Showing{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {filtered.length}
              </span>{" "}
              {aiBusy && magicActive
                ? "matching jobs (updating…)"
                : magicActive && aiRows !== null
                  ? "matching jobs (Magic Search + Firestore)"
                  : magicActive
                    ? "matching jobs (browser filter)"
                    : "jobs in view"}
            </p>
            {journeys.length !== filtered.length ? (
              <p className="text-xs">
                {journeys.length} loaded from office (max batch)
              </p>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <Card className="border-dashed p-4 text-sm text-muted">
              {magicActive && filterChips.length > 0 ? (
                <>
                  <p className="font-medium text-foreground">No jobs match these filters</p>
                  <p className="mt-1">
                    Try a different plate or branch, clear the search, or tap a
                    “Did you mean” registration if shown above.
                  </p>
                </>
              ) : (
                <p>
                  No jobs matched. Try vehicle registration, branch, driver name,
                  or a Magic Search phrase (3+ characters).
                </p>
              )}
            </Card>
          ) : null}
          <ul className="flex flex-col gap-2">
            {filtered.map((j) => (
              <li key={j.id}>
                <Card className="p-4">
                  <p className="font-semibold">
                    {j.vehicleRegistration} · {j.journeyType}
                    {j.wasCancelled ? (
                      <span className="ml-2 text-xs font-semibold text-danger">
                        Cancelled
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted">
                    {j.driverName} · {j.homeBranch} · {j.status}
                  </p>
                  <p className="text-xs text-muted">
                    {j.startTime.toLocaleString("en-GB")}
                    {j.endTime
                      ? ` → ${j.endTime.toLocaleString("en-GB")}`
                      : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </ManagerPageShell>
  );
}
