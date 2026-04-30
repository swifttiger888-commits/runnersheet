import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { rateLimitOrResponse } from "@/lib/rate-limit";
import { signVoiceToken, type VoiceAction } from "@/lib/voice-token";

export const runtime = "nodejs";

type TokenBody = {
  action?: VoiceAction;
  ttlMinutes?: number;
};

function readBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export async function POST(req: Request) {
  const idToken = readBearer(req);
  if (!idToken) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as TokenBody;
  const action = body.action;
  if (action !== "start" && action !== "end") {
    return NextResponse.json(
      { error: "action must be 'start' or 'end'." },
      { status: 400 },
    );
  }

  // Security default: short-lived by default; still configurable for automation.
  const ttl = Number.isFinite(body.ttlMinutes)
    ? Number(body.ttlMinutes)
    : 60 * 24;
  const ttlMinutes = Math.min(60 * 24 * 30, Math.max(5, Math.round(ttl)));

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const limited = rateLimitOrResponse(req, {
      scope: "api:voice-token",
      userId: decoded.uid,
      limit: 12,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const userId = decoded.uid;
    const exp = Date.now() + ttlMinutes * 60 * 1000;
    const token = signVoiceToken({ sub: userId, act: action, exp });
    return NextResponse.json({
      ok: true,
      action,
      token,
      userId,
      expiresAt: new Date(exp).toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
  }
}
