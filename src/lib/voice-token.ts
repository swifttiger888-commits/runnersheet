import { createHmac, timingSafeEqual } from "node:crypto";

export type VoiceAction = "start" | "end";

type VoiceTokenPayload = {
  sub: string;
  act: VoiceAction;
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getVoiceSecret(): string {
  const secret = process.env.VOICE_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("VOICE_LINK_SECRET is not configured.");
  }
  return secret;
}

function signRaw(message: string): string {
  const h = createHmac("sha256", getVoiceSecret());
  h.update(message);
  return h.digest("base64url");
}

export function signVoiceToken(payload: VoiceTokenPayload): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = signRaw(encoded);
  return `${encoded}.${sig}`;
}

export function verifyVoiceToken(
  token: string,
  action: VoiceAction,
): { ok: true; userId: string } | { ok: false; reason: string } {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return { ok: false, reason: "Malformed token." };

  const expected = signRaw(encoded);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid token signature." };
  }

  let payload: VoiceTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as VoiceTokenPayload;
  } catch {
    return { ok: false, reason: "Invalid token payload." };
  }

  if (!payload?.sub?.trim()) return { ok: false, reason: "Missing subject." };
  if (payload.act !== action) return { ok: false, reason: "Wrong token action." };
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    return { ok: false, reason: "Token expired." };
  }

  return { ok: true, userId: payload.sub.trim() };
}
