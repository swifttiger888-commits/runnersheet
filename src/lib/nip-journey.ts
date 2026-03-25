import type { JourneyRecord } from "@/types/journey";

/**
 * NIP instant must fall strictly after journey start and strictly before journey end,
 * or the journey must still be active (no end yet) with start before NIP.
 */
export function journeyCoversNipInstant(j: JourneyRecord, nip: Date): boolean {
  const nipMs = nip.getTime();
  if (j.startTime.getTime() >= nipMs) return false;
  if (j.status === "active") return true;
  if (j.endTime != null && j.endTime.getTime() > nipMs) return true;
  return false;
}

export function formatNipNominationCopy(params: {
  journey: JourneyRecord;
  nipDateTime: Date;
}): string {
  const j = params.journey;
  const fmt = (d: Date) =>
    d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const endLine =
    j.status === "active"
      ? "In progress (active journey — no end time yet)"
      : j.endTime
        ? fmt(j.endTime)
        : "—";
  const certifiedVehicleLine = [
    j.certifiedVehicleMake,
    j.certifiedVehicleModel,
  ]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" ")
    .trim();
  const certifiedColor = j.certifiedVehicleColor?.trim() || "";
  const certifiedDisplay =
    certifiedVehicleLine && certifiedColor
      ? `${certifiedVehicleLine} · ${certifiedColor}`
      : certifiedVehicleLine || certifiedColor || "—";

  return [
    "RunnerSheet — NIP nomination (driver & journey details)",
    "",
    `Driver name: ${j.driverName}`,
    `Employee ID: ${j.driverId}`,
    `Home branch: ${j.homeBranch}`,
    `Vehicle registration: ${j.vehicleRegistration}`,
    `Certified vehicle: ${certifiedDisplay}`,
    "",
    `Alleged offence date/time (NIP): ${fmt(params.nipDateTime)}`,
    `Journey started: ${fmt(j.startTime)}`,
    `Journey ended: ${endLine}`,
    `Starting odometer (miles): ${j.startingMileage}`,
    `Ending odometer (miles): ${j.endingMileage != null ? String(j.endingMileage) : "—"}`,
    "",
    `Journey record ID: ${j.id}`,
  ].join("\n");
}
