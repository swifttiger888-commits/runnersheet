"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
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
import { buildDriverJourneyPdf } from "@/lib/pdf-report";
import {
  formatUkPostcode,
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";
import type { JourneyRecord } from "@/types/journey";
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
  const runningLabel = useRunningLabel(active);

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
    if (vehicleLookupState !== "found" || !certifiedVehicle) {
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
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.href = url;
      a.download = `runnersheet-${safeName}-${reportBranch}-${reportFromDate}-to-${reportToDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
              {vehicleLookupState === "not_found" || vehicleLookupState === "error" ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {vehicleLookupError}
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
                vehicleLookupState === "not_found" ||
                vehicleLookupState !== "found"
              }
              type="submit"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Start job
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
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
              {reportBusy ? "Generating PDF..." : "Download my report"}
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
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {label}
              </p>
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
                          </>
                        );
                      })()}
                    </Card>
                  </li>
                ))}
              </ul>
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
