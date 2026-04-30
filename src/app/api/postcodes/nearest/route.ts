import { NextResponse } from "next/server";
import { nearestUkPostcodeFromLatLng } from "@/lib/postcodes-io";
import { rateLimitOrResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const limited = rateLimitOrResponse(req, {
    scope: "api:postcodes-nearest",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon") ?? url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Coordinates out of range." }, { status: 400 });
  }

  try {
    const r = await nearestUkPostcodeFromLatLng(lat, lon);
    if (!r) {
      return NextResponse.json({ postcode: null, distanceM: null });
    }
    return NextResponse.json({
      postcode: r.postcode,
      distanceM: r.distanceM,
    });
  } catch {
    return NextResponse.json(
      { error: "Postcode service unavailable." },
      { status: 502 },
    );
  }
}
