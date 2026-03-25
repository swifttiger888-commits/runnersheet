import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  formatUkPostcode,
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";
import { verifyVoiceToken } from "@/lib/voice-token";

export const runtime = "nodejs";

type StartBody = {
  vrm?: string;
  destination?: string;
  token?: string;
};

async function startJourneyForVoice(input: {
  vrm: string;
  destination: string;
  token: string;
}) {
  const verified = verifyVoiceToken(input.token, "start");
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }
  const userId = verified.userId;
  const db = getAdminDb();

  const activeSnap = await db
    .collection("journeys")
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!activeSnap.empty) {
    return NextResponse.json(
      { error: "You already have an active journey. End it first." },
      { status: 409 },
    );
  }

  const userDoc = await db.collection("users").doc(userId).get();
  const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
  const driverName = String(userData.name ?? "Voice Driver").trim() || "Voice Driver";
  const driverId =
    String(userData.employeeId ?? userId).trim() || userId;
  const homeBranch =
    String(userData.homeBranch ?? "Unknown").trim() || "Unknown";

  const created = await db.collection("journeys").add({
    userId,
    driverId,
    driverName,
    journeyType: "Delivery",
    vehicleRegistration: input.vrm,
    startingMileage: 0,
    endingMileage: null,
    destinationPostcode: input.destination || null,
    homeBranch,
    startOriginType: "branch",
    startOriginLabel: "Voice",
    startTime: FieldValue.serverTimestamp(),
    endTime: null,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    milesTraveled: null,
    durationSeconds: null,
    certifiedVehicleMake: "Unknown",
    certifiedVehicleModel: "Unknown",
    certifiedVehicleColor: "Unknown",
  });

  return NextResponse.json({
    ok: true,
    journeyId: created.id,
    vrm: input.vrm,
    destination: input.destination || null,
  });
}

function parseStart(input: {
  vrm?: string;
  destination?: string;
  token?: string;
}) {
  const vrm = formatUkVehicleRegistration(input.vrm ?? "");
  const destination = formatUkPostcode(input.destination ?? "");
  const token = input.token?.trim() ?? "";
  if (!token || !sanitizeAlphanumericUpper(vrm)) return null;
  return { token, vrm, destination };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseStart({
    vrm: searchParams.get("vrm") ?? undefined,
    destination:
      searchParams.get("destination") ?? searchParams.get("dest") ?? undefined,
    token: searchParams.get("t") ?? searchParams.get("token") ?? undefined,
  });

  if (!parsed) {
    return NextResponse.json(
      { error: "token and vrm are required." },
      { status: 400 },
    );
  }

  try {
    return await startJourneyForVoice(parsed);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not start voice journey right now.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as StartBody;
  const parsed = parseStart({
    vrm: body.vrm,
    destination: body.destination,
    token: body.token,
  });
  if (!parsed) {
    return NextResponse.json(
      { error: "token and vrm are required." },
      { status: 400 },
    );
  }

  try {
    return await startJourneyForVoice(parsed);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not start voice journey right now.",
      },
      { status: 500 },
    );
  }
}
