import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type LimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  userId?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __rsRateLimitStore: Map<string, Bucket> | undefined;
}

const store = globalThis.__rsRateLimitStore ?? new Map<string, Bucket>();
globalThis.__rsRateLimitStore = store;

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function cleanupStore(now: number) {
  // Opportunistic cleanup: keep memory bounded without timers.
  if (store.size < 2000) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export function rateLimitOrResponse(
  req: Request,
  options: LimitOptions,
): NextResponse | null {
  const now = Date.now();
  cleanupStore(now);

  const actor = options.userId?.trim() || getClientIp(req);
  const key = `${options.scope}:${actor}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  current.count += 1;
  store.set(key, current);
  if (current.count <= options.limit) return null;

  const retryAfterSec = Math.max(
    1,
    Math.ceil((current.resetAt - now) / 1000),
  );
  return NextResponse.json(
    {
      error: "Too many requests. Please wait and try again.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
