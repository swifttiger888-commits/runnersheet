import { NextResponse } from "next/server";

export function readBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export async function requireAuthedUser(
  req: Request,
): Promise<{ uid: string } | NextResponse> {
  const idToken = readBearerToken(req);
  if (!idToken) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }
  try {
    const { getAdminAuth } = await import("@/lib/firebase-admin");
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (err) {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
    if (!apiKey) {
      console.error("[auth] firebase verify failed and API key missing", err);
      return NextResponse.json(
        { error: "Auth backend is not configured on this deployment." },
        { status: 503 },
      );
    }

    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
          cache: "no-store",
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        users?: Array<{ localId?: string }>;
      };
      const uid = payload.users?.[0]?.localId?.trim();
      if (!res.ok || !uid) {
        return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
      }
      return { uid };
    } catch (fallbackErr) {
      console.error("[auth] fallback verify failed", fallbackErr);
      return NextResponse.json(
        { error: "Auth service temporarily unavailable." },
        { status: 503 },
      );
    }
  }
}
