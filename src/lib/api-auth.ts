import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

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
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
  }
}
