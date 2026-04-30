"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  History,
  Home,
  Loader2,
  LogOut,
  MapPin,
  PlayCircle,
  XCircle,
  StopCircle,
  WifiOff,
} from "lucide-react";
import {
  ActiveJourneyChrome,
  ACTIVE_JOURNEY_CHROME_BOTTOM_PAD_CLASS,
} from "@/components/driver/active-journey-chrome";
import { TripEtaPanel } from "@/components/driver/trip-eta-panel";
import { AppShell } from "@/components/app-shell";
import { BranchSelector } from "@/components/branch-selector";
import { LoadingScreen } from "@/components/loading-screen";
import { OpenInMaps } from "@/components/open-in-maps";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkingBranch } from "@/config/branches";
import { useAuth } from "@/context/auth-context";
import { useBranches } from "@/context/branches-context";
import { useJourneyData } from "@/context/journey-data-context";
import { useSessionBranch } from "@/context/session-branch-context";
import { useHybridTripEta } from "@/hooks/use-hybrid-trip-eta";
import { useRunningLabel } from "@/hooks/use-running-label";
import { trackGa4Event } from "@/lib/analytics";
import { getAuthHeader } from "@/lib/client-auth";
import { journeyDateLabel } from "@/lib/date-labels";
import { ensureFirebaseClients } from "@/lib/firebase";
import { gpsCoordsStartLabel } from "@/lib/gps-start-label";
import {
  canDriverCorrectJourneyUntil5pm,
  JOURNEY_CORRECTION_REASON_OPTIONS,
  JOURNEY_CORRECTION_NOTE_MAX_CHARS,
} from "@/lib/journey-corrections";
import { buildDriverJourneyPdf } from "@/lib/pdf-report";
import { openPdfPreview } from "@/lib/pdf-preview";
import {
  formatUkPostcode,
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";
import type { JourneyCorrectionReason, JourneyRecord } from "@/types/journey";
type VehicleLookupState = "idle" | "loading" | "found" | "not_found" | "error";

function formatDurationLabel(durationSeconds: number | null | undefined) {
  if (durationSeconds == null) return "";
  const totalMinutes = Math.max(0, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function toDateTimeLocalInputValue(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Typical runs are local; flag likely missed end-times quickly.
const LATE_END_THRESHOLD_SECONDS = 2 * 60 * 60;
const VERY_LATE_END_THRESHOLD_SECONDS = 8 * 60 * 60;

export default function DriverDashboardPage() {
  const router = useRouter();
  const { ready, role, user, profile, signOutUser } = useAuth();
  const { workingBranch, setWorkingBranch } = useSessionBranch();
  const { getPostcodeByBranchName } = useBranches();
  const {
    journeys,
    loading,
    hasPendingWrites,
    error,
    startJourney,
    endJourney,
    correctJourney,
  } = useJourneyData();

  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vehicleLookupState, setVehicleLookupState] =
    useState<VehicleLookupState>("idle");
  const [vehicleLookupError, setVehicleLookupError] = useState<string | null>(null);
  const [certifiedVehicle, setCertifiedVehicle] = useState<{
    make: string;
    model: string;
    color: string;
  } | null>(null);
  const [cacheOnlyPlateId, setCacheOnlyPlateId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showSyncedNotice, setShowSyncedNotice] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportBranch, setReportBranch] = useState<WorkingBranch>("Leeds");
  const [reportFromDate, setReportFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reportToDate, setReportToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [correctionStart, setCorrectionStart] = useState("");
  const [correctionEnd, setCorrectionEnd] = useState("");
  const [correctionReason, setCorrectionReason] =
    useState<JourneyCorrectionReason>("forgot_to_end");
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const hadPendingWritesRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (role !== "driver") router.replace("/login");
  }, [ready, role, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setIsOnline(window.navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  useEffect(() => {
    if (hasPendingWrites) hadPendingWritesRef.current = true;
  }, [hasPendingWrites]);

  useEffect(() => {
    if (!isOnline || hasPendingWrites) {
      setShowSyncedNotice(false);
      return;
    }
    if (!hadPendingWritesRef.current) return;
    setShowSyncedNotice(true);
    hadPendingWritesRef.current = false;
    const t = window.setTimeout(() => setShowSyncedNotice(false), 2800);
    return () => window.clearTimeout(t);
  }, [isOnline, hasPendingWrites]);

  const active = useMemo(
    () => journeys.find((j) => j.status === "active"),
    [journeys],
  );
  const [activeNowMs, setActiveNowMs] = useState(() => Date.now());
  const runningLabel = useRunningLabel(active);

  useEffect(() => {
    if (!active) return;
    const tick = () => setActiveNowMs(Date.now());
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, [active]);

  const activeDurationSeconds = useMemo(() => {
    if (!active) return 0;
    return Math.max(
      0,
      Math.round((activeNowMs - active.startTime.getTime()) / 1000),
    );
  }, [active, activeNowMs]);

  const needsEndReminder = activeDurationSeconds >= LATE_END_THRESHOLD_SECONDS;
  const isVeryLateReminder = activeDurationSeconds >= VERY_LATE_END_THRESHOLD_SECONDS;
  const isAfterCutoff = useMemo(() => {
    const now = new Date(activeNowMs);
    return now.getHours() >= 17;
  }, [activeNowMs]);
  const startedToday = useMemo(() => {
    if (!active) return false;
    const now = new Date(activeNowMs);
    return active.startTime.toDateString() === now.toDateString();
  }, [active, activeNowMs]);
  const isPastSameDayCutoff = Boolean(active && startedToday && isAfterCutoff);

  const branchForEta = useMemo((): WorkingBranch => {
    const hb = active?.homeBranch?.trim();
    if (hb) return hb;
    return workingBranch;
  }, [active, workingBranch]);

  const destinationForEta = active?.destinationPostcode?.trim() || "";

  const branchPostcode = useMemo(
    () => getPostcodeByBranchName(branchForEta),
    [getPostcodeByBranchName, branchForEta],
  );

  const tripEta = useHybridTripEta({
    destinationPostcode: destinationForEta || null,
    branchLabel: branchForEta,
    branchPostcode,
    enabled: Boolean(profile) && !loading,
  });
  const {
    gpsCoords,
    gpsStatus,
    requestLocation,
    clearLocation,
    gpsNearestPostcode,
    gpsNearestPostcodeDistanceM,
    gpsPostcodeLoading,
  } = tripEta;

  useEffect(() => {
    if (active) return;
    if (gpsStatus !== "idle") return;
    requestLocation();
  }, [active, gpsStatus, requestLocation]);

  const focusEndJourneySection = useCallback(() => {
    const card = document.getElementById("active-journey-card");
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const completed = useMemo(
    () =>
      journeys
        .filter((j) => j.status === "completed")
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
    [journeys],
  );

  useEffect(() => {
    setReportBranch(workingBranch);
  }, [workingBranch]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, JourneyRecord[]>();
    for (const j of completed) {
      const label = journeyDateLabel(j.endTime ?? j.startTime);
      const arr = map.get(label) ?? [];
      arr.push(j);
      map.set(label, arr);
    }
    return map;
  }, [completed]);
  const [expandedHistoryLabels, setExpandedHistoryLabels] = useState<string[]>([]);

  useEffect(() => {
    const labels = Array.from(groupedHistory.keys());
    if (labels.length === 0) {
      setExpandedHistoryLabels([]);
      return;
    }
    const todayLabel = journeyDateLabel(new Date());
    const defaultLabel = labels.includes(todayLabel) ? todayLabel : labels[0]!;
    setExpandedHistoryLabels((prev) => {
      if (prev.length > 0 && prev.some((l) => labels.includes(l))) {
        return prev.filter((l) => labels.includes(l));
      }
      return [defaultLabel];
    });
  }, [groupedHistory]);

  const openCorrectionEditor = useCallback((journey: JourneyRecord) => {
    if (!journey.endTime) return;
    setEditingJourneyId(journey.id);
    setCorrectionStart(toDateTimeLocalInputValue(journey.startTime));
    setCorrectionEnd(toDateTimeLocalInputValue(journey.endTime));
    setCorrectionReason("forgot_to_end");
    setCorrectionNote("");
  }, []);

  const closeCorrectionEditor = useCallback(() => {
    setEditingJourneyId(null);
    setCorrectionNote("");
  }, []);

  const submitCorrection = useCallback(async () => {
    if (!editingJourneyId) return;
    const start = new Date(correctionStart);
    const end = new Date(correctionEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError("Please provide valid correction times.");
      return;
    }
    try {
      setCorrectionBusy(true);
      setFormError(null);
      await correctJourney({
        journeyId: editingJourneyId,
        startTime: start,
        endTime: end,
        reason: correctionReason,
        note: correctionNote,
      });
      setEditingJourneyId(null);
      setCorrectionNote("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Correction failed.");
    } finally {
      setCorrectionBusy(false);
    }
  }, [
    editingJourneyId,
    correctionStart,
    correctionEnd,
    correctionReason,
    correctionNote,
    correctJourney,
  ]);

  const reportBranches = useMemo(() => {
    const set = new Set<WorkingBranch>();
    for (const j of completed) {
      if (j.homeBranch) set.add(j.homeBranch as WorkingBranch);
    }
    if (set.size === 0) set.add(workingBranch);
    return Array.from(set);
  }, [completed, workingBranch]);

  const quickTapPlates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const j of journeys) {
      const plate = formatUkVehicleRegistration(j.vehicleRegistration);
      const id = sanitizeAlphanumericUpper(plate);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(plate);
      if (out.length >= 3) break;
    }
    return out;
  }, [journeys]);

  const certifiedVehicleLabel = useMemo(() => {
    if (!certifiedVehicle) return "";
    const make = certifiedVehicle.make?.trim() || "Unknown";
    const modelRaw = certifiedVehicle.model?.trim() || "";
    const color = certifiedVehicle.color?.trim() || "Unknown";
    const hideModel =
      !modelRaw ||
      modelRaw.toLowerCase() === "unknown" ||
      modelRaw.toLowerCase() === "null";
    return hideModel ? `${make} · ${color}` : `${make} · ${modelRaw} · ${color}`;
  }, [certifiedVehicle]);

  const loadFromVehicleCache = useCallback(async (rawPlate: string) => {
    const plate = formatUkVehicleRegistration(rawPlate);
    const plateId = sanitizeAlphanumericUpper(plate);
    if (!plateId) return false;
    const clients = await ensureFirebaseClients();
    if (!clients) return false;
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(clients.db, "vehicles", plateId));
    if (!snap.exists()) return false;
    const row = snap.data() as {
      make?: unknown;
      model?: unknown;
      color?: unknown;
      colour?: unknown;
    };
    setCertifiedVehicle({
      make: String(row.make ?? "").trim() || "Unknown",
      model: String(row.model ?? "").trim() || "Unknown",
      color: String(row.color ?? row.colour ?? "").trim() || "Unknown",
    });
    setVehicleLookupState("found");
    setVehicleLookupError(null);
    return true;
  }, []);

  const handleQuickTap = useCallback(
    async (plate: string) => {
      setVehicleRegistration(plate);
      setCacheOnlyPlateId(sanitizeAlphanumericUpper(plate));
      setVehicleLookupState("loading");
      setVehicleLookupError(null);
      setCertifiedVehicle(null);
      try {
        const found = await loadFromVehicleCache(plate);
        if (!found) {
          setVehicleLookupState("not_found");
          setVehicleLookupError("No cached vehicle details for this plate yet.");
        }
      } catch {
        setVehicleLookupState("error");
        setVehicleLookupError("Could not load cached vehicle details.");
      }
    },
    [loadFromVehicleCache],
  );

  useEffect(() => {
    if (active) return;
    const reg = formatUkVehicleRegistration(vehicleRegistration);
    const plateId = sanitizeAlphanumericUpper(reg);
    if (!reg) {
      setVehicleLookupState("idle");
      setVehicleLookupError(null);
      setCertifiedVehicle(null);
      setCacheOnlyPlateId(null);
      return;
    }
    let cancelled = false;
    // Start in a quiet state: only show spinner if DVLA call is actually needed.
    setVehicleLookupState("idle");
    setVehicleLookupError(null);
    setCertifiedVehicle(null);
    const timer = window.setTimeout(async () => {
      try {
        const clients = await ensureFirebaseClients();
        if (clients) {
          const { doc, getDoc } = await import("firebase/firestore");
          const vehicleRef = doc(clients.db, "vehicles", plateId);
          const cacheSnap = await getDoc(vehicleRef);
          if (cancelled) return;
          if (cacheSnap.exists()) {
            const row = cacheSnap.data() as {
              make?: unknown;
              model?: unknown;
              color?: unknown;
              colour?: unknown;
            };
            setCertifiedVehicle({
              make: String(row.make ?? "").trim() || "Unknown",
              model: String(row.model ?? "").trim() || "Unknown",
              color:
                String(row.color ?? row.colour ?? "").trim() || "Unknown",
            });
            setVehicleLookupState("found");
            return;
          }
          if (cacheOnlyPlateId === plateId) {
            setVehicleLookupState("not_found");
            setVehicleLookupError("No cached vehicle details for this plate yet.");
            return;
          }
        }

        setVehicleLookupState("loading");
        const authHeader = await getAuthHeader();
        const res = await fetch(
          `/api/dvla/vehicle?registration=${encodeURIComponent(reg)}`,
          { headers: authHeader },
        );
        const data = (await res.json().catch(() => ({}))) as {
          found?: boolean;
          make?: string;
          model?: string;
          color?: string;
          error?: string;
          errorCode?: string | null;
        };
        if (cancelled) return;
        if (res.ok && data.found) {
          const vehicle = {
            make: data.make?.trim() || "Unknown",
            model: data.model?.trim() || "Unknown",
            color: data.color?.trim() || "Unknown",
          };
          setCertifiedVehicle(vehicle);
          setVehicleLookupState("found");
          if (clients) {
            const { doc, serverTimestamp, setDoc } = await import(
              "firebase/firestore"
            );
            const vehicleRef = doc(clients.db, "vehicles", plateId);
            void setDoc(
              vehicleRef,
              {
                registrationPlate: plateId,
                make: vehicle.make,
                model: vehicle.model,
                color: vehicle.color,
                source: "dvla",
                lastVerifiedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
              },
              { merge: true },
            ).catch(() => {
              /* cache write is best-effort; never block start flow */
            });
          }
          return;
        }
        const isNotFound = data.errorCode === "NOT_FOUND" || res.status === 404;
        setVehicleLookupState(isNotFound ? "not_found" : "error");
        setVehicleLookupError(
          isNotFound
            ? "Vehicle not found. Check the registration plate."
            : data.error || "Could not verify this plate with DVLA right now.",
        );
      } catch {
        if (cancelled) return;
        setVehicleLookupState("error");
        setVehicleLookupError("Could not verify this plate with DVLA right now.");
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [vehicleRegistration, active, cacheOnlyPlateId]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!profile) {
      setFormError("Your profile is still loading. Please try again.");
      return;
    }
    if (vehicleLookupState === "not_found") {
      setFormError("We couldn't find that vehicle. Please check the registration.");
      return;
    }
    if (vehicleLookupState === "loading" || vehicleLookupState === "idle") {
      setFormError("Please wait for DVLA check to finish before starting.");
      return;
    }
    setBusy(true);
    try {
      const usingGpsOrigin = gpsStatus === "granted";
      if (usingGpsOrigin && gpsPostcodeLoading) {
        setFormError("Wait for nearest postcode to finish, or switch to branch.");
        setBusy(false);
        return;
      }
      const gpsOriginLabel = gpsNearestPostcode
        ? formatUkPostcode(gpsNearestPostcode)
        : gpsCoordsStartLabel(gpsCoords) ?? "GPS (location only)";
      const gpsDestination = gpsNearestPostcode
        ? formatUkPostcode(gpsNearestPostcode)
        : "";
      await startJourney({
        journeyType: "Delivery",
        vehicleRegistration,
        startingMileage: 0,
        destinationPostcode: gpsDestination,
        homeBranch: workingBranch,
        startOriginType: usingGpsOrigin ? "gps" : "branch",
        startOriginLabel: usingGpsOrigin ? gpsOriginLabel : workingBranch,
        certifiedVehicle,
      });
      trackGa4Event("driver_journey_start", {
        journey_type: "Delivery",
        home_branch: workingBranch,
      });
      setVehicleRegistration("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't start job right now.");
    } finally {
      setBusy(false);
    }
  }

  async function getCurrentGpsPostcode() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 9000,
          maximumAge: 30000,
        });
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const res = await fetch(
        `/api/postcodes/nearest?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as {
        postcode?: string | null;
      };
      if (!data.postcode) return null;
      return formatUkPostcode(data.postcode);
    } catch {
      return null;
    }
  }

  async function handleEnd() {
    if (!active) return;
    setFormError(null);
    setBusy(true);
    try {
      const endPostcode = await getCurrentGpsPostcode();
      await endJourney(active.id, undefined, { destinationPostcode: endPostcode });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not end job.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelRoute() {
    if (!active) return;
    setFormError(null);
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Cancel this route? Use this only if the manager has cancelled the job.",
          );
    if (!ok) return;
    setBusy(true);
    try {
      await endJourney(active.id, undefined, { cancelled: true });
      trackGa4Event("driver_journey_cancel_route", {
        home_branch: active.homeBranch,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not cancel route.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadMyReport() {
    if (!profile) return;
    const fromDate = new Date(`${reportFromDate}T00:00:00`);
    const toDate = new Date(`${reportToDate}T23:59:59`);
    if (fromDate > toDate) {
      setFormError("Report date range is invalid. Set From date before To date.");
      return;
    }
    setFormError(null);
    setReportBusy(true);
    try {
      const bytes = await buildDriverJourneyPdf({
        branch: reportBranch,
        driverName: profile.name,
        fromDate,
        toDate,
        journeys: completed,
      });
      const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      openPdfPreview({
        bytes: new Uint8Array(bytes),
        fallbackDownloadName: `runnersheet-${safeName}-${reportBranch}-${reportFromDate}-to-${reportToDate}.pdf`,
      });
    } finally {
      setReportBusy(false);
    }
  }

  if (!ready || role !== "driver") {
    return (
      <AppShell showBrand>
        <LoadingScreen label="Checking session…" />
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell showBrand title="Driver">
        <p className="text-sm text-muted">
          Profile missing. For Firebase, add Firestore{" "}
          <code className="font-mono text-xs">users/{user?.uid ?? "…"}</code> with{" "}
          <code className="font-mono text-xs">name</code>,{" "}
          <code className="font-mono text-xs">employeeId</code>,{" "}
          <code className="font-mono text-xs">homeBranch</code>.
        </p>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell showBrand title={`Hello, ${profile.name}`}>
        <LoadingScreen label="Loading jobs…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      showBrand
      title={`Hello, ${profile.name}`}
      actions={
        <Button
          variant="ghost"
          className="min-h-10 gap-1.5 px-3 text-xs font-semibold"
          onClick={() => void signOutUser()}
          type="button"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      }
    >
      <div
        className={
          active ? `flex min-h-0 flex-1 flex-col gap-6 ${ACTIVE_JOURNEY_CHROME_BOTTOM_PAD_CLASS}` : "flex min-h-0 flex-1 flex-col gap-6"
        }
      >
      <BranchSelector
        mode="driver"
        value={workingBranch}
        onChange={setWorkingBranch}
      />

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger shadow-card-quiet">
          {error}
        </p>
      ) : null}
      {!isOnline ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-[#8f7a3a]/35 bg-[#8f7a3a]/10 px-3 py-2 text-xs text-[#e9d89f]">
          <WifiOff className="h-4 w-4" aria-hidden />
          Offline mode — jobs will sync once signal returns.
        </p>
      ) : null}
      {isOnline && hasPendingWrites ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-primary/80" aria-hidden />
          Syncing jobs to office…
        </p>
      ) : null}
      {showSyncedNotice ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          All jobs synced to office.
        </p>
      ) : null}
      {active && (needsEndReminder || isPastSameDayCutoff) ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            isPastSameDayCutoff
              ? "border-danger/35 bg-danger-bg text-danger"
              : "border-[#8f7a3a]/35 bg-[#8f7a3a]/12 text-[#f0dca4]"
          }`}
          role="alert"
        >
          <p className="inline-flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {isPastSameDayCutoff
              ? "Journey is still open after 5:00 PM."
              : isVeryLateReminder
                ? "Journey has been active for a long time — end it if finished."
                : "Reminder: end your journey when the job is complete."}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>
              Active for {formatDurationLabel(activeDurationSeconds) || "0 min"}.
            </span>
            <button
              type="button"
              onClick={focusEndJourneySection}
              className="font-semibold text-primary underline underline-offset-4 hover:opacity-90"
            >
              Jump to End job
            </button>
          </div>
        </div>
      ) : null}

      {active ? (
        <Card
          className="border border-border border-l-[3px] border-l-primary ring-1 ring-primary/20"
          id="active-journey-card"
        >
          <CardHeader>
            <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" aria-hidden />
                Active job
              </span>
              {runningLabel ? (
                <span className="text-xs font-medium tabular-nums text-primary">
                  {runningLabel}
                </span>
              ) : null}
            </CardTitle>
            <p className="text-sm text-muted">
              {active.journeyType} · {active.vehicleRegistration}
              {active.destinationPostcode ? ` · ${active.destinationPostcode}` : ""}
            </p>
            <p className="text-sm">
              Started{" "}
              {active.startTime.toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <TripEtaPanel eta={tripEta} showLocationControls />
          </CardHeader>
          <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3">
            {active.destinationPostcode ? (
              <OpenInMaps destination={active.destinationPostcode} />
            ) : (
              <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
                GPS destination will be captured when you tap{" "}
                <span className="font-semibold text-foreground">End job</span>.
              </p>
            )}
            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="w-full gap-2"
                disabled={busy}
                onClick={() => void handleEnd()}
                type="button"
              >
                <StopCircle className="h-4 w-4" aria-hidden />
                End job
              </Button>
              <Button
                className="w-full gap-2 border-danger/35 text-danger hover:bg-danger-bg"
                disabled={busy}
                onClick={() => void handleCancelRoute()}
                type="button"
                variant="secondary"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Cancel route
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {!active ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" aria-hidden />
              Start job
            </CardTitle>
            <p className="text-sm text-muted">
              Enter the vehicle and start the job; start/end locations are captured automatically from GPS.
            </p>
            <p className="text-xs text-muted">
              Number plates are formatted automatically.
            </p>
          </CardHeader>
          <form
            className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3"
            onSubmit={handleStart}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="veh">Vehicle registration</Label>
              {quickTapPlates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {quickTapPlates.map((plate) => (
                    <button
                      key={plate}
                      type="button"
                      onClick={() => void handleQuickTap(plate)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {plate}
                    </button>
                  ))}
                </div>
              ) : null}
              <Input
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                id="veh"
                inputMode="text"
                onChange={(e) => {
                  setCacheOnlyPlateId(null);
                  setVehicleRegistration(
                    formatUkVehicleRegistration(e.target.value),
                  );
                }}
                placeholder="AB12 CDE"
                value={vehicleRegistration}
              />
              {vehicleLookupState === "loading" ? (
                <div className="space-y-1.5" aria-live="polite">
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/80" aria-hidden />
                    Searching DVLA…
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted-bg/70">
                    <div className="h-full w-2/5 animate-pulse rounded-full bg-primary/45" />
                  </div>
                </div>
              ) : null}
              {vehicleLookupState === "found" && certifiedVehicle ? (
                <p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {certifiedVehicleLabel}
                </p>
              ) : null}
              {vehicleLookupState === "not_found" ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {vehicleLookupError}
                </p>
              ) : null}
              {vehicleLookupState === "error" ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {vehicleLookupError || "DVLA unavailable"} — you can still start your journey.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Job start (From)</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 px-3 text-xs"
                  onClick={requestLocation}
                  disabled={gpsStatus === "loading"}
                >
                  {gpsStatus === "loading" ? "Finding GPS…" : "Refresh GPS"}
                </Button>
              </div>
              <p className="text-xs text-muted">
                Start recorded as:{" "}
                {gpsStatus === "granted" ? (
                  gpsPostcodeLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2
                        className="h-3 w-3 animate-spin text-primary/80"
                        aria-hidden
                      />
                      Finding nearest postcode…
                    </span>
                  ) : gpsNearestPostcode ? (
                    <>
                      {formatUkPostcode(gpsNearestPostcode)}
                      <span className="text-muted"> (nearest to GPS)</span>
                      {typeof gpsNearestPostcodeDistanceM === "number" &&
                      gpsNearestPostcodeDistanceM > 2000 ? (
                        <span className="mt-1 block text-[11px] text-danger">
                          GPS looks inaccurate (~
                          {Math.round(gpsNearestPostcodeDistanceM / 100) / 10}{" "}
                          km to nearest postcode). Move outdoors, wait for the
                          fix, or tap My location again — or use branch.
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="font-mono tabular-nums text-foreground">
                        {gpsCoordsStartLabel(gpsCoords) ?? "Your location"}
                      </span>
                      <span className="text-muted">
                        {" "}
                        — no nearby UK postcode. Tap My location again or use branch.
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <span>{workingBranch}</span>
                    <span className="text-muted">
                      {" "}
                      (GPS unavailable, using branch fallback)
                    </span>
                  </>
                )}
              </p>
            </div>
            <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
              Destination is captured automatically from GPS when you tap{" "}
              <span className="font-semibold text-foreground">End job</span>.
            </p>
            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <Button
              className={`w-full gap-2 text-base ${
                vehicleLookupState === "found" ? "min-h-14 shadow-control" : "min-h-12"
              }`}
              disabled={
                busy ||
                vehicleLookupState === "loading" ||
                vehicleLookupState === "idle" ||
                vehicleLookupState === "not_found"
              }
              type="submit"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Start job
            </Button>
          </form>
        </Card>
      ) : null}

      <Card id="driver-report-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" aria-hidden />
            My printable report (PDF)
          </CardTitle>
          <p className="text-sm text-muted">
            Export your own journeys for hard-copy records.
          </p>
        </CardHeader>
        <div className="grid gap-3 border-t border-border px-5 pb-5 pt-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-branch">Branch</Label>
            <select
              id="report-branch"
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground shadow-inset-field"
              value={reportBranch}
              onChange={(e) => setReportBranch(e.target.value as WorkingBranch)}
            >
              {reportBranches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-from">From date</Label>
            <Input
              id="report-from"
              type="date"
              value={reportFromDate}
              onChange={(e) => setReportFromDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-to">To date</Label>
            <Input
              id="report-to"
              type="date"
              value={reportToDate}
              onChange={(e) => setReportToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={() => void handleDownloadMyReport()}
              disabled={reportBusy}
            >
              <Download className="h-4 w-4" aria-hidden />
              {reportBusy ? "Generating PDF..." : "Preview / print my report"}
            </Button>
          </div>
        </div>
      </Card>

      {completed.length > 0 ? (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <History className="h-5 w-5 text-primary" aria-hidden />
            History
          </h2>
          {Array.from(groupedHistory.entries()).map(([label, rows]) => (
            <div key={label}>
              <button
                type="button"
                className="mb-2 inline-flex w-full items-center justify-between rounded-xl border border-border/70 bg-surface/50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted transition-colors hover:bg-muted-bg/35"
                onClick={() =>
                  setExpandedHistoryLabels((prev) =>
                    prev.includes(label)
                      ? prev.filter((l) => l !== label)
                      : [...prev, label],
                  )
                }
                aria-expanded={expandedHistoryLabels.includes(label)}
              >
                <span>
                  {label} · {rows.length}
                </span>
                {expandedHistoryLabels.includes(label) ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                )}
              </button>
              {expandedHistoryLabels.includes(label) ? (
                <ul className="flex flex-col gap-2">
                  {rows.map((j) => (
                    <li key={j.id}>
                      <Card className="p-4 shadow-card-quiet!">
                        {(() => {
                          const startLabel = j.startTime.toLocaleString("en-GB", {
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const sameDayAsStart =
                            j.endTime != null &&
                            j.endTime.toDateString() === j.startTime.toDateString();
                          const endLabel = j.endTime
                            ? sameDayAsStart
                              ? j.endTime.toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : j.endTime.toLocaleString("en-GB", {
                                  weekday: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                            : "In progress";
                          const durationLabel = formatDurationLabel(j.durationSeconds);
                          const isLateEnded =
                            !j.wasCancelled &&
                            j.durationSeconds != null &&
                            j.durationSeconds >= LATE_END_THRESHOLD_SECONDS;
                          const isVeryLateEnded =
                            !j.wasCancelled &&
                            j.durationSeconds != null &&
                            j.durationSeconds >= VERY_LATE_END_THRESHOLD_SECONDS;
                          return (
                            <>
                              <p className="flex items-center gap-2 font-semibold text-foreground">
                                <span>
                                  {j.vehicleRegistration} ·{" "}
                                  {j.wasCancelled ? (
                                    <span className="text-danger">Cancelled</span>
                                  ) : (j.correctionLog?.length ?? 0) > 0 ? (
                                    <span>
                                      Complete ·{" "}
                                      <span className="text-[#d7c286]">Edited</span>
                                    </span>
                                  ) : (
                                    "Complete"
                                  )}
                                </span>
                                {isLateEnded ? (
                                  <span className="rounded-full border border-[#8f7a3a]/40 bg-[#8f7a3a]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#e9d89f]">
                                    {isVeryLateEnded ? "Ended very late" : "Ended late"}
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-sm text-muted">
                                {startLabel} - {endLabel}
                                {durationLabel ? ` · ${durationLabel}` : ""}
                              </p>
                              <p className="text-sm text-muted">
                                From {j.startOriginLabel ?? j.homeBranch} · To{" "}
                                {j.destinationPostcode ?? "Not set"}
                              </p>
                              {(j.correctionLog?.length ?? 0) > 0 ? (
                                <p className="text-xs text-muted">
                                  Last corrected:{" "}
                                  {j.correctionLog[j.correctionLog.length - 1]?.editedAt.toLocaleString(
                                    "en-GB",
                                  )}
                                </p>
                              ) : null}
                              {!j.wasCancelled ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {(() => {
                                    const gate = canDriverCorrectJourneyUntil5pm(
                                      j.startTime,
                                      new Date(),
                                    );
                                    if (!gate.allowed) {
                                      return (
                                        <p className="text-xs text-muted">
                                          Correction locked: {gate.reason}
                                        </p>
                                      );
                                    }
                                    return (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => openCorrectionEditor(j)}
                                        disabled={correctionBusy}
                                      >
                                        Correct times
                                      </Button>
                                    );
                                  })()}
                                </div>
                              ) : null}
                              {editingJourneyId === j.id ? (
                                <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-surface/60 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                                    Correction (allowed until 5:00 PM same day)
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label htmlFor={`correct-start-${j.id}`}>Start time</Label>
                                      <Input
                                        id={`correct-start-${j.id}`}
                                        type="datetime-local"
                                        value={correctionStart}
                                        onChange={(e) => setCorrectionStart(e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`correct-end-${j.id}`}>End time</Label>
                                      <Input
                                        id={`correct-end-${j.id}`}
                                        type="datetime-local"
                                        value={correctionEnd}
                                        onChange={(e) => setCorrectionEnd(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`correct-reason-${j.id}`}>Reason (required)</Label>
                                    <select
                                      id={`correct-reason-${j.id}`}
                                      value={correctionReason}
                                      onChange={(e) =>
                                        setCorrectionReason(
                                          e.target.value as JourneyCorrectionReason,
                                        )
                                      }
                                      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
                                    >
                                      {JOURNEY_CORRECTION_REASON_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`correct-note-${j.id}`}>
                                      Notes (optional, max{" "}
                                      {JOURNEY_CORRECTION_NOTE_MAX_CHARS} characters)
                                    </Label>
                                    <textarea
                                      id={`correct-note-${j.id}`}
                                      rows={3}
                                      maxLength={JOURNEY_CORRECTION_NOTE_MAX_CHARS}
                                      value={correctionNote}
                                      onChange={(e) => setCorrectionNote(e.target.value)}
                                      placeholder="Short context for manager review (one or two sentences is enough)"
                                      className="min-h-24 w-full resize-y rounded-xl border border-border/90 bg-background px-3.5 py-2.5 text-sm text-foreground shadow-inset-field outline-none transition-[box-shadow,border-color] duration-200 placeholder:text-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    <p className="text-right text-xs text-muted">
                                      {correctionNote.length} / {JOURNEY_CORRECTION_NOTE_MAX_CHARS}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      onClick={() => void submitCorrection()}
                                      disabled={correctionBusy}
                                    >
                                      {correctionBusy ? "Saving..." : "Save correction"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={closeCorrectionEditor}
                                      disabled={correctionBusy}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {completed.length === 0 && !active ? (
        <Card className="border-dashed py-8 text-center text-sm text-muted">
          No completed jobs yet.
        </Card>
      ) : null}

      <p className="text-center text-sm text-muted">
        <Link
          className="inline-flex items-center justify-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          href="/"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          Home
        </Link>
      </p>
      </div>

      {active ? (
        <ActiveJourneyChrome
          key={active.id}
          active={active}
          onEndJourneyFocus={focusEndJourneySection}
        />
      ) : null}
    </AppShell>
  );
}
