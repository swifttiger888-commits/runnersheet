import { NextResponse } from "next/server";

import { buildMeta } from "@/generated/build-meta";
import { getRateLimitMetrics } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({
    service: "runnersheet",
    ...buildMeta,
    rateLimit: {
      scopes: getRateLimitMetrics(),
    },
  });
}
