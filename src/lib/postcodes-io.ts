/**
 * UK postcode → coordinates via postcodes.io (no API key; fair-use limits apply).
 * @see https://postcodes.io/
 */

export type LatLng = { lat: number; lng: number };

export async function geocodeUkPostcode(
  postcode: string,
  signal?: AbortSignal,
): Promise<LatLng | null> {
  const normalized = postcode.replace(/\s+/g, "").trim();
  if (normalized.length < 5) return null;
  const encoded = encodeURIComponent(normalized);
  const res = await fetch(`https://api.postcodes.io/postcodes/${encoded}`, {
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    result?: { latitude?: number; longitude?: number };
  };
  const lat = data.result?.latitude;
  const lng = data.result?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

/** Nearest UK postcode to a lat/lng via postcodes.io (no API key). */
export async function nearestUkPostcodeFromLatLng(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ postcode: string; distanceM: number | null } | null> {
  const url = `https://api.postcodes.io/postcodes?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&limit=1`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    result?: Array<{ postcode?: string; distance?: number }> | null;
  };
  const first = Array.isArray(data.result) ? data.result[0] : null;
  const pc = first?.postcode?.trim();
  if (!pc) return null;
  const d = first?.distance;
  return {
    postcode: pc,
    distanceM: typeof d === "number" && Number.isFinite(d) ? d : null,
  };
}
