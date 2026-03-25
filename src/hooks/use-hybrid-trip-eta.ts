"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/postcodes-io";
import { geocodeUkPostcode } from "@/lib/postcodes-io";
import {
  estimateDriveMinutesRange,
  formatEtaRangeLabel,
  haversineKm,
} from "@/lib/trip-eta";

const GPS_STORAGE_KEY = "rs_trip_eta_gps_v1";
/** Ignore stored GPS older than this — stale coords caused wrong postcodes (~miles off). */
const GPS_PERSIST_MAX_AGE_MS = 10 * 60 * 1000;

type StoredGpsPayload = { lat: number; lng: number; at: number };

function readStoredGps(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GPS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredGpsPayload>;
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    if (typeof p.at !== "number" || Date.now() - p.at > GPS_PERSIST_MAX_AGE_MS) {
      clearPersistedGps();
      return null;
    }
    return { lat: p.lat, lng: p.lng };
  } catch {
    /* ignore */
  }
  return null;
}

function persistGps(coords: LatLng) {
  if (typeof sessionStorage === "undefined") return;
  const payload: StoredGpsPayload = {
    lat: coords.lat,
    lng: coords.lng,
    at: Date.now(),
  };
  sessionStorage.setItem(GPS_STORAGE_KEY, JSON.stringify(payload));
}

function clearPersistedGps() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(GPS_STORAGE_KEY);
}

export type HybridTripEta = {
  /** Current GPS fix when granted (same as used for nearest-postcode lookup). */
  gpsCoords: LatLng | null;
  /** e.g. "About 12–24 min" */
  rangeLabel: string | null;
  /** Where the start point came from */
  originHint: string | null;
  /** True while resolving destination postcode */
  destinationLoading: boolean;
  /** Destination could not be resolved */
  destinationUnavailable: boolean;
  /** Resolving branch depot from postcode */
  branchOriginLoading: boolean;
  gpsStatus: "idle" | "loading" | "granted" | "denied" | "unavailable" | "error";
  requestLocation: () => void;
  clearLocation: () => void;
  /** Nearest UK postcode to current GPS (postcodes.io), when GPS is granted */
  gpsNearestPostcode: string | null;
  /** Metres from GPS point to postcode centroid (postcodes.io); null if unknown */
  gpsNearestPostcodeDistanceM: number | null;
  gpsPostcodeLoading: boolean;
};

type Options = {
  destinationPostcode: string | null | undefined;
  /** Branch label for hints (display name). */
  branchLabel: string;
  /** UK postcode for branch location (from Firestore `branches`). */
  branchPostcode: string | null | undefined;
  enabled: boolean;
};

export function useHybridTripEta({
  destinationPostcode,
  branchLabel,
  branchPostcode,
  enabled,
}: Options): HybridTripEta {
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationBad, setDestinationBad] = useState(false);
  const [branchOriginCoords, setBranchOriginCoords] = useState<LatLng | null>(
    null,
  );
  const [branchOriginLoading, setBranchOriginLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<LatLng | null>(() =>
    readStoredGps(),
  );
  const [gpsStatus, setGpsStatus] = useState<HybridTripEta["gpsStatus"]>(() =>
    readStoredGps() ? "granted" : "idle",
  );
  const [gpsNearestPostcode, setGpsNearestPostcode] = useState<string | null>(
    null,
  );
  const [gpsNearestPostcodeDistanceM, setGpsNearestPostcodeDistanceM] = useState<
    number | null
  >(null);
  const [gpsPostcodeLoading, setGpsPostcodeLoading] = useState(false);

  const abortDestRef = useRef<AbortController | null>(null);
  const abortBranchRef = useRef<AbortController | null>(null);
  const abortGpsPcRef = useRef<AbortController | null>(null);

  const pc = (destinationPostcode ?? "").trim();
  const bp = (branchPostcode ?? "").trim();

  useEffect(() => {
    if (!enabled) {
      abortDestRef.current?.abort();
      return;
    }
    abortDestRef.current?.abort();
    if (!pc) {
      queueMicrotask(() => {
        setDestCoords(null);
        setDestinationBad(false);
        setDestinationLoading(false);
      });
      return;
    }
    const cleaned = pc.replace(/\s+/g, "");
    if (cleaned.length < 5) {
      queueMicrotask(() => {
        setDestCoords(null);
        setDestinationBad(false);
        setDestinationLoading(false);
      });
      return;
    }

    const t = window.setTimeout(() => {
      const ac = new AbortController();
      abortDestRef.current = ac;
      queueMicrotask(() => {
        setDestinationLoading(true);
        setDestinationBad(false);
      });
      void geocodeUkPostcode(pc, ac.signal)
        .then((ll) => {
          if (ac.signal.aborted) return;
          setDestinationLoading(false);
          if (ll) {
            setDestCoords(ll);
            setDestinationBad(false);
          } else {
            setDestCoords(null);
            setDestinationBad(true);
          }
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setDestinationLoading(false);
          setDestCoords(null);
          setDestinationBad(true);
        });
    }, 450);

    return () => {
      clearTimeout(t);
      abortDestRef.current?.abort();
    };
  }, [enabled, pc]);

  useEffect(() => {
    if (!enabled) {
      abortBranchRef.current?.abort();
      queueMicrotask(() => {
        setBranchOriginCoords(null);
        setBranchOriginLoading(false);
      });
      return;
    }
    abortBranchRef.current?.abort();
    if (!bp) {
      queueMicrotask(() => {
        setBranchOriginCoords(null);
        setBranchOriginLoading(false);
      });
      return;
    }

    const ac = new AbortController();
    abortBranchRef.current = ac;
    queueMicrotask(() => setBranchOriginLoading(true));
    void geocodeUkPostcode(bp, ac.signal)
      .then((ll) => {
        if (ac.signal.aborted) return;
        setBranchOriginLoading(false);
        setBranchOriginCoords(ll);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setBranchOriginLoading(false);
        setBranchOriginCoords(null);
      });

    return () => {
      ac.abort();
    };
  }, [enabled, bp]);

  useEffect(() => {
    abortGpsPcRef.current?.abort();
    if (!enabled || !gpsCoords || gpsStatus !== "granted") {
      queueMicrotask(() => {
        setGpsNearestPostcode(null);
        setGpsNearestPostcodeDistanceM(null);
        setGpsPostcodeLoading(false);
      });
      return;
    }
    const ac = new AbortController();
    abortGpsPcRef.current = ac;
    queueMicrotask(() => {
      setGpsPostcodeLoading(true);
      setGpsNearestPostcode(null);
      setGpsNearestPostcodeDistanceM(null);
    });
    const q = new URLSearchParams({
      lat: String(gpsCoords.lat),
      lon: String(gpsCoords.lng),
    });
    void fetch(`/api/postcodes/nearest?${q.toString()}`, { signal: ac.signal })
      .then(async (res) => {
        if (ac.signal.aborted) return;
        const data = (await res.json().catch(() => ({}))) as {
          postcode?: string | null;
          distanceM?: number | null;
        };
        if (!res.ok) {
          setGpsNearestPostcode(null);
          setGpsNearestPostcodeDistanceM(null);
          setGpsPostcodeLoading(false);
          return;
        }
        const pc =
          typeof data.postcode === "string" && data.postcode.trim()
            ? data.postcode.trim()
            : null;
        const d = data.distanceM;
        setGpsNearestPostcode(pc);
        setGpsNearestPostcodeDistanceM(
          typeof d === "number" && Number.isFinite(d) ? d : null,
        );
        setGpsPostcodeLoading(false);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setGpsNearestPostcode(null);
        setGpsNearestPostcodeDistanceM(null);
        setGpsPostcodeLoading(false);
      });
    return () => ac.abort();
  }, [enabled, gpsCoords, gpsStatus]);

  const origin = useMemo(() => {
    return gpsCoords ?? branchOriginCoords;
  }, [gpsCoords, branchOriginCoords]);

  const originHint = useMemo(() => {
    if (!destCoords) return null;
    if (gpsCoords) return "Rough driving time from your location.";
    if (branchOriginCoords) {
      return `Rough driving time from ${branchLabel} (branch postcode). Use your location for a closer estimate.`;
    }
    return `Add a postcode for ${branchLabel} in Manage branches to estimate drive time from the depot.`;
  }, [branchLabel, branchOriginCoords, destCoords, gpsCoords]);

  const rangeLabel = useMemo(() => {
    if (!destCoords || !enabled || !origin) return null;
    const km = haversineKm(origin, destCoords);
    const { min, max } = estimateDriveMinutesRange(km);
    return formatEtaRangeLabel(min, max);
  }, [destCoords, enabled, origin]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGpsCoords(coords);
        persistGps(coords);
        setGpsStatus("granted");
      },
      (err: GeolocationPositionError) => {
        if (err.code === 1) setGpsStatus("denied");
        else setGpsStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 25_000,
        maximumAge: 0,
      },
    );
  }, []);

  const clearLocation = useCallback(() => {
    setGpsCoords(null);
    clearPersistedGps();
    setGpsStatus("idle");
    setGpsNearestPostcode(null);
    setGpsNearestPostcodeDistanceM(null);
    setGpsPostcodeLoading(false);
  }, []);

  return {
    gpsCoords,
    rangeLabel,
    originHint,
    destinationLoading,
    destinationUnavailable: destinationBad && !destinationLoading && pc.length >= 5,
    branchOriginLoading,
    gpsStatus,
    requestLocation,
    clearLocation,
    gpsNearestPostcode,
    gpsNearestPostcodeDistanceM,
    gpsPostcodeLoading,
  };
}
