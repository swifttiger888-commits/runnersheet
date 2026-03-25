import { NextResponse } from "next/server";

type JourneySearchStatus = "active" | "completed";
type AiJourneyFilters = {
  vehicleRegistration?: string;
  driverId?: string;
  homeBranch?: string;
  status?: JourneySearchStatus;
  journeyType?: "Delivery" | "Collection" | "Runner";
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
};

type AiJourneyIntent = {
  kind: "journeys";
  filters: AiJourneyFilters;
  needsDisambiguation: boolean;
  confidence: number;
  interpretation: string;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const TRANSLATOR_PROMPT = `You are "RunnerSheet Translator".
Convert manager natural-language search into STRICT JSON for Firestore journey filters.

Return JSON ONLY. No markdown. No explanation.
Schema:
{
  "kind": "journeys",
  "filters": {
    "vehicleRegistration"?: string,
    "driverId"?: string,
    "homeBranch"?: string,
    "status"?: "active" | "completed",
    "journeyType"?: "Delivery" | "Collection" | "Runner",
    "vehicleMake"?: string,
    "vehicleModel"?: string,
    "vehicleColor"?: string
  },
  "needsDisambiguation": boolean,
  "confidence": number,
  "interpretation": string
}

Rules:
- If unsure, omit fields instead of guessing.
- Uppercase vehicleRegistration with no spaces.
- Keep confidence between 0 and 1.
- Keep interpretation short and plain.
- kind must always be "journeys".`;

function normalizeIntent(input: unknown): AiJourneyIntent {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rawFilters = (raw.filters ?? {}) as Record<string, unknown>;
  const filters: AiJourneyFilters = {};
  const read = (key: keyof AiJourneyFilters) => {
    const v = rawFilters[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const reg = read("vehicleRegistration");
  if (reg) filters.vehicleRegistration = reg.replace(/\s+/g, "").toUpperCase();
  const driverId = read("driverId");
  if (driverId) filters.driverId = driverId;
  const homeBranch = read("homeBranch");
  if (homeBranch) filters.homeBranch = homeBranch;
  const status = read("status");
  if (status === "active" || status === "completed") filters.status = status;
  const journeyType = read("journeyType");
  if (
    journeyType === "Delivery" ||
    journeyType === "Collection" ||
    journeyType === "Runner"
  ) {
    filters.journeyType = journeyType;
  }
  const vehicleMake = read("vehicleMake");
  if (vehicleMake) filters.vehicleMake = vehicleMake;
  const vehicleModel = read("vehicleModel");
  if (vehicleModel) filters.vehicleModel = vehicleModel;
  const vehicleColor = read("vehicleColor");
  if (vehicleColor) filters.vehicleColor = vehicleColor;

  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.55;

  return {
    kind: "journeys",
    filters,
    needsDisambiguation: Boolean(raw.needsDisambiguation),
    confidence,
    interpretation:
      typeof raw.interpretation === "string" && raw.interpretation.trim()
        ? raw.interpretation.trim()
        : "Search journeys",
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
  };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Missing search text." }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "DeepSeek API key not configured." },
      { status: 500 },
    );
  }

  // Fixed product default: fast chat model for JSON extraction. Override via DEEPSEEK_MODEL only (server-side).
  const model =
    process.env.DEEPSEEK_MODEL?.trim() ||
    process.env.DEEPSEEK_ACTIVE_MODEL?.trim() ||
    "deepseek-chat";
  const endpoint =
    process.env.DEEPSEEK_API_ENDPOINT?.trim() ||
    "https://api.deepseek.com/chat/completions";

  try {
    const deepSeekRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TRANSLATOR_PROMPT },
          { role: "user", content: text },
        ],
      }),
      cache: "no-store",
    });

    const payload = (await deepSeekRes.json().catch(() => ({}))) as DeepSeekChatResponse;
    if (!deepSeekRes.ok) {
      return NextResponse.json(
        { error: "DeepSeek request failed.", details: payload },
        { status: deepSeekRes.status },
      );
    }

    const content = payload.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as unknown;
    const intent = normalizeIntent(parsed);
    return NextResponse.json({ intent, model });
  } catch {
    return NextResponse.json(
      { error: "Could not reach DeepSeek right now." },
      { status: 502 },
    );
  }
}
