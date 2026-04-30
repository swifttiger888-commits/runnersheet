"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
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
import { correctionReasonLabel } from "@/lib/journey-corrections";
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
  dateFrom?: string;
  dateTo?: string;
  excludeCancelled?: boolean;
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

async function readMagicSearchResponse(res: Response): Promise<{
  intent?: AiIntent;
  error?: string;
}> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as { intent?: AiIntent; error?: string };
  } catch {
    // Some upstream/runtime failures can return plain-text bodies.
    return { error: raw.slice(0, 240).trim() };
  }
}

function formatMagicSearchError(
  res: Response,
  payload: { intent?: AiIntent; error?: string },
): string {
  const detail = payload.error?.trim();
  if (detail) {
    const lower = detail.toLowerCase();
    if (lower.includes("missing bearer token") || lower.includes("invalid auth token")) {
      return "Your session expired. Please sign in again.";
    }
    if (lower.includes("provider authentication failed")) {
      return "Magic Search is misconfigured on the server. Please contact an admin.";
    }
    if (lower.includes("internal server error")) {
      return "Magic Search is temporarily unavailable. Please try again shortly.";
    }
    return detail;
  }
  if (res.status >= 500) {
    return "Magic Search is temporarily unavailable. Please try again shortly.";
  }
  const statusLabel = res.status ? `HTTP ${res.status}` : "HTTP error";
  return `Magic Search failed (${statusLabel}).`;
}

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
): { key: string; label: string; clear: () => AiFilters }[] {
  const chips: { key: string; label: string }[] = [];
  const out: { key: string; label: string; clear: () => AiFilters }[] = [];
  if (filters.vehicleRegistration?.trim()) {
    out.push({
      key: "reg",
      label: `Plate ${filters.vehicleRegistration.trim()}`,
      clear: () => ({ ...filters, vehicleRegistration: undefined }),
    });
  }
  if (filters.homeBranch?.trim()) {
    out.push({
      key: "branch",
      label: `Branch ${filters.homeBranch.trim()}`,
      clear: () => ({ ...filters, homeBranch: undefined }),
    });
  }
  if (filters.status) {
    out.push({
      key: "status",
      label: filters.status === "active" ? "Active only" : "Completed only",
      clear: () => ({ ...filters, status: undefined }),
    });
  }
  if (filters.journeyType) {
    out.push({
      key: "type",
      label: filters.journeyType,
      clear: () => ({ ...filters, journeyType: undefined }),
    });
  }
  if (filters.vehicleMake?.trim()) {
    out.push({
      key: "make",
      label: `Make ${filters.vehicleMake.trim()}`,
      clear: () => ({ ...filters, vehicleMake: undefined }),
    });
  }
  if (filters.vehicleModel?.trim()) {
    out.push({
      key: "model",
      label: `Model ${filters.vehicleModel.trim()}`,
      clear: () => ({ ...filters, vehicleModel: undefined }),
    });
  }
  if (filters.vehicleColor?.trim()) {
    out.push({
      key: "color",
      label: `Colour ${filters.vehicleColor.trim()}`,
      clear: () => ({ ...filters, vehicleColor: undefined }),
    });
  }
  if (filters.driverId?.trim()) {
    out.push({
      key: "emp",
      label: `ID ${filters.driverId.trim()}`,
      clear: () => ({ ...filters, driverId: undefined }),
    });
  }
  if (filters.dateFrom?.trim() || filters.dateTo?.trim()) {
    const from = filters.dateFrom?.trim() || "…";
    const to = filters.dateTo?.trim() || "…";
    out.push({
      key: "date",
      label: `Dates ${from} to ${to}`,
      clear: () => ({ ...filters, dateFrom: undefined, dateTo: undefined }),
    });
  }
  if (filters.excludeCancelled) {
    out.push({
      key: "exc-cancel",
      label: "Exclude cancelled",
      clear: () => ({ ...filters, excludeCancelled: undefined }),
    });
  }
  for (const name of localDriverNames) {
    const n = name.trim();
    if (n) {
      out.push({
        key: `drv-${n}`,
        label: `Driver contains “${n}” (local)`,
        clear: () => ({ ...filters }),
      });
    }
  }
  return out;
}

function isoDateOnly(input: Date): string {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, "0");
  const d = `${input.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseRelativeDateRange(text: string): { dateFrom?: string; dateTo?: string } {
  const q = text.trim().toLowerCase();
  if (!q) return {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (q.includes("today")) {
    return { dateFrom: isoDateOnly(startOfToday), dateTo: isoDateOnly(endOfToday) };
  }
  if (q.includes("yesterday")) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - 1);
    return { dateFrom: isoDateOnly(d), dateTo: isoDateOnly(d) };
  }
  if (q.includes("last week")) {
    const day = startOfToday.getDay();
    const mondayOffset = (day + 6) % 7;
    const thisWeekStart = new Date(startOfToday);
    thisWeekStart.setDate(thisWeekStart.getDate() - mondayOffset);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    return { dateFrom: isoDateOnly(lastWeekStart), dateTo: isoDateOnly(lastWeekEnd) };
  }
  if (q.includes("this week")) {
    const day = startOfToday.getDay();
    const mondayOffset = (day + 6) % 7;
    const weekStart = new Date(startOfToday);
    weekStart.setDate(weekStart.getDate() - mondayOffset);
    return { dateFrom: isoDateOnly(weekStart), dateTo: isoDateOnly(endOfToday) };
  }
  if (q.includes("last month")) {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      dateFrom: isoDateOnly(firstOfLastMonth),
      dateTo: isoDateOnly(endOfLastMonth),
    };
  }
  return {};
}

function isFollowUpQuery(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /^(now|only|just|and|also|plus|then|exclude|without|remove|filter)\b/.test(t);
}

function parseFollowUpFlags(text: string): Partial<AiFilters> {
  const t = text.trim().toLowerCase();
  const out: Partial<AiFilters> = {};
  if (/(exclude|without|no)\s+cancelled/.test(t)) out.excludeCancelled = true;
  if (/(include|with)\s+cancelled/.test(t)) out.excludeCancelled = false;
  return out;
}

function mergeFilters(
  previous: AiFilters | null,
  next: AiFilters,
  text: string,
): AiFilters {
  const followUp = isFollowUpQuery(text);
  const base = followUp && previous ? previous : {};
  const merged: AiFilters = { ...base, ...next };
  return { ...merged, ...parseFollowUpFlags(text) };
}

/** Manager list: approval + review flags (corrections, late entries, etc.). */
function managerReviewBadge(j: JourneyRecord): {
  label: string;
  className: string;
} | null {
  if (j.isApproved === true) {
    return {
      label: "Approved",
      className: "border-emerald-600/40 bg-emerald-600/12 text-emerald-100",
    };
  }
  if (j.isApproved === false) {
    return {
      label: "Rejected",
      className: "border-danger/45 bg-danger/10 text-danger",
    };
  }
  if (j.needsReview) {
    return {
      label: "Needs review",
      className: "border-[#8f7a3a]/40 bg-[#8f7a3a]/15 text-[#e9d89f]",
    };
  }
  return null;
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
  const [auditOpenJourneyId, setAuditOpenJourneyId] = useState<string | null>(null);
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
  ): Promise<number> => {
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setAiRows(localFiltered);
      return localFiltered.length;
    }
    const fs = await import("firebase/firestore");
    const { Timestamp, collection, getDocs, limit, orderBy, query, where } = fs;
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
    if (filters.dateFrom) {
      const from = new Date(`${filters.dateFrom}T00:00:00`);
      if (!Number.isNaN(from.getTime())) {
        constraints.push(where("startTime", ">=", Timestamp.fromDate(from)));
      }
    }
    if (filters.dateTo) {
      const to = new Date(`${filters.dateTo}T23:59:59.999`);
      if (!Number.isNaN(to.getTime())) {
        constraints.push(where("startTime", "<=", Timestamp.fromDate(to)));
      }
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
    if (filters.excludeCancelled) {
      rows = rows.filter((r) => !r.wasCancelled);
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
    return rows.length;
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
          const data = await readMagicSearchResponse(res);
          if (!res.ok || !data.intent) {
            setAiError(formatMagicSearchError(res, data));
            setAiRows(null);
            setAiIntent(null);
            setDidYouMeanRegs([]);
            setActiveFilterMeta(null);
            return;
          }
          const dateHints = parseRelativeDateRange(text);
          const mergedBase: AiFilters = {
            ...data.intent.filters,
            dateFrom: data.intent.filters.dateFrom ?? dateHints.dateFrom,
            dateTo: data.intent.filters.dateTo ?? dateHints.dateTo,
          };
          const mergedFilters = mergeFilters(activeFilterMeta?.filters ?? null, mergedBase, text);
          const mergedIntent: AiIntent = { ...data.intent, filters: mergedFilters };
          setAiIntent(mergedIntent);
          setActiveFilterMeta({
            filters: mergedFilters,
            localDriverNames: localMatches.matchedDriverNames,
          });
          if (!usesFirebaseAuth) {
            setAiRows(localFiltered);
            setDidYouMeanRegs([]);
            return;
          }
          const strictCount = await runFirestoreMagicSearch(mergedFilters, localMatches);
          if (strictCount === 0 && mergedIntent.confidence < 0.62) {
            setAiRows(localFiltered);
          }
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
  }, [
    q,
    usesFirebaseAuth,
    localFiltered,
    redactSensitiveTerms,
    runFirestoreMagicSearch,
    activeFilterMeta,
  ]);

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
          Driver names/IDs are matched locally and redacted before AI.
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
                    <li key={c.key}>
                      <button
                        type="button"
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted-bg/50"
                        onClick={() => {
                          const nextFilters = c.clear();
                          setActiveFilterMeta((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  filters: nextFilters,
                                }
                              : prev,
                          );
                          const nextRows = journeys.filter((r) => {
                            if (nextFilters.vehicleRegistration && r.vehicleRegistration !== nextFilters.vehicleRegistration) return false;
                            if (nextFilters.driverId && r.driverId !== nextFilters.driverId) return false;
                            if (nextFilters.status && r.status !== nextFilters.status) return false;
                            if (nextFilters.journeyType && r.journeyType !== nextFilters.journeyType) return false;
                            if (nextFilters.homeBranch && !r.homeBranch.toLowerCase().includes(nextFilters.homeBranch.toLowerCase())) return false;
                            if (nextFilters.vehicleMake && !(r.certifiedVehicleMake ?? "").toLowerCase().includes(nextFilters.vehicleMake.toLowerCase())) return false;
                            if (nextFilters.vehicleModel && !(r.certifiedVehicleModel ?? "").toLowerCase().includes(nextFilters.vehicleModel.toLowerCase())) return false;
                            if (nextFilters.vehicleColor && !(r.certifiedVehicleColor ?? "").toLowerCase().includes(nextFilters.vehicleColor.toLowerCase())) return false;
                            if (nextFilters.excludeCancelled && r.wasCancelled) return false;
                            if (nextFilters.dateFrom) {
                              const from = new Date(`${nextFilters.dateFrom}T00:00:00`);
                              if (r.startTime < from) return false;
                            }
                            if (nextFilters.dateTo) {
                              const to = new Date(`${nextFilters.dateTo}T23:59:59.999`);
                              if (r.startTime > to) return false;
                            }
                            return true;
                          });
                          setAiRows(nextRows);
                        }}
                        aria-label={`Remove filter ${c.label}`}
                      >
                        {c.label} <span className="ml-1 text-muted">x</span>
                      </button>
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
                    const data = await readMagicSearchResponse(res);
                    if (!res.ok || !data.intent) {
                      setAiError(formatMagicSearchError(res, data));
                      setAiRows(null);
                      setAiIntent(null);
                      setActiveFilterMeta(null);
                      return;
                    }
                    const dateHints = parseRelativeDateRange(t);
                    const mergedBase: AiFilters = {
                      ...data.intent.filters,
                      dateFrom: data.intent.filters.dateFrom ?? dateHints.dateFrom,
                      dateTo: data.intent.filters.dateTo ?? dateHints.dateTo,
                    };
                    const mergedFilters = mergeFilters(activeFilterMeta?.filters ?? null, mergedBase, t);
                    const mergedIntent: AiIntent = { ...data.intent, filters: mergedFilters };
                    setAiIntent(mergedIntent);
                    setActiveFilterMeta({
                      filters: mergedFilters,
                      localDriverNames: localMatches.matchedDriverNames,
                    });
                    if (!usesFirebaseAuth) {
                      setAiRows(filterManagerJourneysLocal(journeys, t));
                      setDidYouMeanRegs([]);
                      return;
                    }
                    const strictCount = await runFirestoreMagicSearch(mergedFilters, localMatches);
                    if (strictCount === 0 && mergedIntent.confidence < 0.62) {
                      setAiRows(filterManagerJourneysLocal(journeys, t));
                    }
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
                    {(j.correctionLog?.length ?? 0) > 0 ? (
                      <span className="ml-2 text-xs font-semibold text-[#d7c286]">
                        Edited
                      </span>
                    ) : null}
                    {(() => {
                      const review = managerReviewBadge(j);
                      if (!review) return null;
                      return (
                        <span
                          className={`ml-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${review.className}`}
                        >
                          {review.label}
                        </span>
                      );
                    })()}
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
                  {(j.correctionLog?.length ?? 0) > 0 ? (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-between rounded-lg border border-border/70 bg-surface/50 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted-bg/30"
                        onClick={() =>
                          setAuditOpenJourneyId((id) =>
                            id === j.id ? null : j.id,
                          )
                        }
                        aria-expanded={auditOpenJourneyId === j.id}
                      >
                        <span>
                          Correction audit · {j.correctionLog.length}{" "}
                          {j.correctionLog.length === 1 ? "entry" : "entries"}
                        </span>
                        {auditOpenJourneyId === j.id ? (
                          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>
                      {auditOpenJourneyId === j.id ? (
                        <ol className="mt-3 list-decimal space-y-3 pl-5 text-xs text-foreground">
                          {j.correctionLog.map((e, i) => (
                            <li key={i} className="pl-0.5">
                              <p className="font-medium text-foreground">
                                {e.editedAt.toLocaleString("en-GB")}
                              </p>
                              <p className="mt-1 text-muted">
                                <span className="text-foreground/90">By</span>{" "}
                                employee {e.editedByDriverId}
                                {e.editedByUid ? (
                                  <>
                                    {" "}
                                    <span className="font-mono text-[11px] text-muted">
                                      (
                                      {e.editedByUid.length > 14
                                        ? `${e.editedByUid.slice(0, 8)}…`
                                        : e.editedByUid}
                                      )
                                    </span>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-1">
                                <span className="text-muted">Reason:</span>{" "}
                                {correctionReasonLabel(e.reason)}
                              </p>
                              {e.note ? (
                                <p className="mt-1.5 max-h-40 overflow-y-auto break-words rounded-md border border-border/50 bg-surface/40 px-2 py-1.5 text-foreground/95 whitespace-pre-wrap">
                                  {e.note}
                                </p>
                              ) : null}
                              <div className="mt-1.5 grid gap-1 rounded-md bg-muted-bg/25 px-2 py-1.5 font-mono text-[11px] leading-snug text-muted">
                                <p>
                                  <span className="text-foreground/80">Start</span>{" "}
                                  {e.previousStartTime.toLocaleString("en-GB")} →{" "}
                                  <span className="text-foreground">
                                    {e.newStartTime.toLocaleString("en-GB")}
                                  </span>
                                </p>
                                <p>
                                  <span className="text-foreground/80">End</span>{" "}
                                  {e.previousEndTime
                                    ? e.previousEndTime.toLocaleString("en-GB")
                                    : "—"}{" "}
                                  →{" "}
                                  <span className="text-foreground">
                                    {e.newEndTime
                                      ? e.newEndTime.toLocaleString("en-GB")
                                      : "—"}
                                  </span>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </ManagerPageShell>
  );
}
