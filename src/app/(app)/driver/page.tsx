"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock3,
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
import { journeyDateLabel } from "@/lib/date-labels";
import { ensureFirebaseClients } from "@/lib/firebase";
import { gpsCoordsStartLabel } from "@/lib/gps-start-label";
import {
  formatUkPostcode,
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";
import type { JourneyRecord } from "@/types/journey";
type VehicleLookupState = "idle" | "loading" | "found" | "not_found" | "error";

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
  const [destinationPostcode, setDestinationPostcode] = useState("");
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

  const destinationForEta =
    active?.destinationPostcode?.trim() || destinationPostcode.trim() || "";

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
        const res = await fetch(
          `/api/dvla/vehicle?registration=${encodeURIComponent(reg)}`,
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
      await startJourney({
        journeyType: "Delivery",
        vehicleRegistration,
        startingMileage: 0,
        destinationPostcode,
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
      setDestinationPostcode("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't start job right now.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    if (!active) return;
    setFormError(null);
    setBusy(true);
    try {
      await endJourney(active.id);
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
              <p className="text-xs text-muted">
                Add a destination postcode next time to get one-tap navigation in Maps.
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
              Enter the vehicle and destination postcode to start the job.
            </p>
            <p className="text-xs text-muted">
              Number plates and postcodes are formatted automatically.
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
                  variant={gpsStatus === "granted" ? "secondary" : "primary"}
                  className="min-h-11 flex-1 px-3 text-xs sm:min-w-40 sm:flex-none"
                  onClick={clearLocation}
                >
                  Branch ({workingBranch})
                </Button>
                <Button
                  type="button"
                  variant={gpsStatus === "granted" ? "primary" : "secondary"}
                  className="min-h-11 flex-1 px-3 text-xs sm:min-w-40 sm:flex-none"
                  onClick={requestLocation}
                  disabled={gpsStatus === "loading"}
                >
                  {gpsStatus === "loading"
                    ? "Finding my location…"
                    : "My location"}
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
                  workingBranch
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest">To postcode</Label>
              <Input
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                id="dest"
                inputMode="text"
                onChange={(e) =>
                  setDestinationPostcode(formatUkPostcode(e.target.value))
                }
                placeholder="LS1 4DY"
                value={destinationPostcode}
              />
              <TripEtaPanel eta={tripEta} showLocationControls={false} />
            </div>
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
                      <p className="flex items-center gap-2 font-semibold text-foreground">
                        <span>
                          {j.vehicleRegistration} ·{" "}
                          {j.wasCancelled ? (
                            <span className="text-danger">Cancelled</span>
                          ) : (
                            "Complete"
                          )}
                        </span>
                      </p>
                      <p className="text-sm text-muted">
                        {j.startTime.toLocaleString("en-GB", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {j.endTime?.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) ?? "In progress"}
                        {j.durationSeconds != null
                          ? ` · ${Math.round(j.durationSeconds / 60)} min`
                          : ""}
                      </p>
                      <p className="text-sm text-muted">
                        From {j.startOriginLabel ?? j.homeBranch} · To{" "}
                        {j.destinationPostcode ?? "Not set"}
                      </p>
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
