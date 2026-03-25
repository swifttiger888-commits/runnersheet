import type { LatLng } from "@/lib/postcodes-io";

/**
 * When reverse geocode to a UK postcode fails, still record a coarse, auditable start hint.
 * ~4 decimals ≈ 11 m; good enough for ops without a full street address.
 */
export function gpsCoordsStartLabel(coords: LatLng | null): string | null {
  if (!coords) return null;
  const { lat, lng } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
