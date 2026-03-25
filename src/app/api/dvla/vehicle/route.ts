import { NextResponse } from "next/server";
import {
  formatUkVehicleRegistration,
  sanitizeAlphanumericUpper,
} from "@/lib/uk-format";

type DvlaVehicleResponse = {
  make?: string;
  model?: string;
  colour?: string;
  errorCode?: string;
  message?: string;
  errors?: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
};

export async function GET(req: Request) {
  const rawReg = new URL(req.url).searchParams.get("registration") ?? "";
  const registration = formatUkVehicleRegistration(rawReg);
  const registrationNumber = sanitizeAlphanumericUpper(registration);
  if (!registrationNumber) {
    return NextResponse.json({ error: "Missing registration." }, { status: 400 });
  }

  const apiKey = process.env.DVLA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "DVLA API key is not configured on this deployment." },
      { status: 500 },
    );
  }

  const endpoint =
    process.env.DVLA_API_ENDPOINT?.trim() ||
    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ registrationNumber }),
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as DvlaVehicleResponse;

    if (!res.ok) {
      const firstErr = payload?.errors?.[0];
      const msg =
        payload?.message || firstErr?.detail || firstErr?.title || "DVLA lookup failed.";
      const msgLower = msg.toLowerCase();
      const isNotFound =
        payload?.errorCode === "NOT_FOUND" ||
        res.status === 404 ||
        msgLower.includes("vehicle not found");
      return NextResponse.json(
        {
          found: false,
          registration: registrationNumber,
          errorCode: isNotFound
            ? "NOT_FOUND"
            : (payload?.errorCode ?? firstErr?.code ?? null),
          error: isNotFound
            ? "Vehicle not found. Check the registration plate."
            : msg,
        },
        { status: res.status },
      );
    }

    return NextResponse.json({
      found: true,
      registration: registrationNumber,
      make: payload.make ?? "",
      model: payload.model ?? "",
      color: payload.colour ?? "",
    });
  } catch {
    return NextResponse.json(
      {
        found: false,
        registration: registrationNumber,
        error: "Could not contact DVLA right now.",
      },
      { status: 502 },
    );
  }
}
