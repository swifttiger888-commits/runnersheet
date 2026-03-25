import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyVoiceToken } from "@/lib/voice-token";

export const runtime = "nodejs";

type EndBody = {
  token?: string;
};

type EndQuery = {
  t?: string;
  token?: string;
};

async function endJourneyForVoice(token: string) {
  const verified = verifyVoiceToken(token, "end");
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }
  const userId = verified.userId;
  const db = getAdminDb();
  const activeSnap = await db
    .collection("journeys")
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .limit(20)
    .get();

  if (activeSnap.empty) {
    return NextResponse.json(
      { error: "No active journey found for this user." },
      { status: 404 },
    );
  }

  // Can't reliably order without a Firestore composite index in this query.
  // Pull a small set and pick the latest by startTime.
  const doc = [...activeSnap.docs].sort((a, b) => {
    const aMs =
      (a.data() as { startTime?: { toMillis?: () => number } }).startTime
        ?.toMillis?.() ?? 0;
    const bMs =
      (b.data() as { startTime?: { toMillis?: () => number } }).startTime
        ?.toMillis?.() ?? 0;
    return bMs - aMs;
  })[0]!;
  const j = doc.data() as {
    startingMileage?: number;
    startTime?: { toMillis?: () => number };
    vehicleRegistration?: string;
  };

  const startMileage =
    typeof j.startingMileage === "number" ? j.startingMileage : 0;
  const nowMs = Date.now();
  const startMs = j.startTime?.toMillis?.() ?? nowMs;
  const durationSeconds = Math.max(0, Math.round((nowMs - startMs) / 1000));

  await doc.ref.update({
    endingMileage: startMileage,
    endTime: FieldValue.serverTimestamp(),
    status: "completed",
    wasCancelled: false,
    milesTraveled: 0,
    durationSeconds,
  });

  return NextResponse.json({
    ok: true,
    journeyId: doc.id,
    vrm: j.vehicleRegistration ?? null,
  });
}

function parseEnd(input: EndQuery) {
  return input.token?.trim() ?? "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = parseEnd({
    token: searchParams.get("t") ?? searchParams.get("token") ?? undefined,
  });
  if (!token) {
    return NextResponse.json(
      { error: "token is required." },
      { status: 400 },
    );
  }
  try {
    return await endJourneyForVoice(token);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not end voice journey right now.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as EndBody;
  const token = parseEnd({ token: body.token });
  if (!token) {
    return NextResponse.json(
      { error: "token is required." },
      { status: 400 },
    );
  }
  try {
    return await endJourneyForVoice(token);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not end voice journey right now.",
      },
      { status: 500 },
    );
  }
}
