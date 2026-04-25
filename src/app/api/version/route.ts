import { NextResponse } from "next/server";

import { buildMeta } from "@/generated/build-meta";

export async function GET() {
  return NextResponse.json({
    service: "runnersheet",
    ...buildMeta,
  });
}
