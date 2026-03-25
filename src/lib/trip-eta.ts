import type { LatLng } from "@/lib/postcodes-io";

const EARTH_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.min(1, x)));
}

/**
 * Rough driving-time band (minutes) from straight-line distance.
 * Short urban legs: effective speeds vary; this stays intentionally wide.
 */
export function estimateDriveMinutesRange(distanceKm: number): {
  min: number;
  max: number;
} {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return { min: 2, max: 8 };
  }
  const minKmh = 18;
  const maxKmh = 40;
  const minMins = Math.ceil((distanceKm / maxKmh) * 60);
  const maxMins = Math.ceil((distanceKm / minKmh) * 60);
  const lo = Math.max(2, minMins);
  const hi = Math.max(lo + 1, maxMins);
  if (distanceKm < 0.4) {
    return { min: 2, max: Math.min(12, hi) };
  }
  return { min: lo, max: hi };
}

export function formatEtaRangeLabel(min: number, max: number): string {
  if (min === max) return `About ${min} min`;
  return `About ${min}–${max} min`;
}
