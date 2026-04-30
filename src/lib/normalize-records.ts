import type { AlertRecord, AlertType } from "@/types/alert";
import { clampCorrectionNote } from "@/lib/journey-corrections";
import type {
  JourneyCorrectionEntry,
  JourneyCorrectionReason,
  JourneyRecord,
  JourneyStartOriginType,
  JourneyStatus,
  JourneyType,
} from "@/types/journey";

const JOURNEY_TYPES: readonly JourneyType[] = [
  "Delivery",
  "Collection",
  "Runner",
] as const;

const ALERT_TYPES: readonly AlertType[] = [
  "HighMileage",
  "MultipleLateEntries",
  "DuplicateVehicleUse",
  "TimeDistanceMismatch",
] as const;

export function isJourneyType(v: unknown): v is JourneyType {
  return JOURNEY_TYPES.includes(v as JourneyType);
}

export function parseJourneyType(v: unknown): JourneyType {
  return isJourneyType(v) ? v : "Delivery";
}

export function parseJourneyStatus(v: unknown): JourneyStatus {
  return v === "completed" ? "completed" : "active";
}

export function parseJourneyStartOriginType(
  v: unknown,
): JourneyStartOriginType | null {
  if (v === "gps") return "gps";
  if (v === "branch") return "branch";
  return null;
}

export function isAlertType(v: unknown): v is AlertType {
  return ALERT_TYPES.includes(v as AlertType);
}

export function parseAlertType(v: unknown): AlertType {
  return isAlertType(v) ? v : "HighMileage";
}

function hasToDate(v: unknown): v is { toDate: () => Date } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  );
}

/** Coerce Firestore Timestamp, ISO string, or Date to Date (fallback: now). */
export function coerceDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  if (hasToDate(value)) return value.toDate();
  return new Date();
}

/** Coerce optional date fields (null/undefined stay null). */
export function coerceDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (hasToDate(value)) return value.toDate();
  return null;
}

function parseCorrectionReason(v: unknown): JourneyCorrectionReason {
  if (v === "forgot_to_end") return v;
  if (v === "forgot_to_start") return v;
  if (v === "app_issue") return v;
  return "other";
}

function normalizeCorrectionLog(value: unknown): JourneyCorrectionEntry[] {
  if (!Array.isArray(value)) return [];
  const out: JourneyCorrectionEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    out.push({
      editedAt: coerceDate(row.editedAt),
      editedByUid: String(row.editedByUid ?? ""),
      editedByDriverId: String(row.editedByDriverId ?? ""),
      reason: parseCorrectionReason(row.reason),
      note: clampCorrectionNote(
        row.note === null || row.note === undefined ? null : String(row.note),
      ),
      previousStartTime: coerceDate(row.previousStartTime),
      newStartTime: coerceDate(row.newStartTime),
      previousEndTime: coerceDateOrNull(row.previousEndTime),
      newEndTime: coerceDateOrNull(row.newEndTime),
    });
  }
  return out;
}

/**
 * Single source of truth for journey shape (Firestore docs + demo JSON).
 */
export function normalizeJourneyRecord(
  id: string,
  data: Record<string, unknown>,
): JourneyRecord {
  const safeId =
    id || (typeof data.id === "string" ? data.id : String(data.id ?? ""));

  return {
    id: safeId || crypto.randomUUID(),
    userId: String(data.userId ?? ""),
    driverId: String(data.driverId ?? ""),
    driverName: String(data.driverName ?? ""),
    journeyType: parseJourneyType(data.journeyType),
    vehicleRegistration: String(data.vehicleRegistration ?? ""),
    startingMileage: Number(data.startingMileage ?? 0),
    endingMileage:
      data.endingMileage === null || data.endingMileage === undefined
        ? null
        : Number(data.endingMileage),
    destinationPostcode:
      data.destinationPostcode === null || data.destinationPostcode === undefined
        ? null
        : String(data.destinationPostcode),
    homeBranch: String(data.homeBranch ?? ""),
    startOriginType: parseJourneyStartOriginType(data.startOriginType),
    startOriginLabel:
      data.startOriginLabel === null || data.startOriginLabel === undefined
        ? null
        : String(data.startOriginLabel),
    startTime: coerceDate(data.startTime),
    endTime: coerceDateOrNull(data.endTime),
    status: parseJourneyStatus(data.status),
    wasCancelled: Boolean(data.wasCancelled),
    createdAt: coerceDate(data.createdAt),
    milesTraveled:
      data.milesTraveled === null || data.milesTraveled === undefined
        ? null
        : Number(data.milesTraveled),
    durationSeconds:
      data.durationSeconds === null || data.durationSeconds === undefined
        ? null
        : Number(data.durationSeconds),
    isLateEntry: Boolean(data.isLateEntry),
    needsReview: Boolean(data.needsReview),
    isApproved:
      data.isApproved === undefined ? null : Boolean(data.isApproved),
    certifiedVehicleMake:
      data.certifiedVehicleMake === null || data.certifiedVehicleMake === undefined
        ? null
        : String(data.certifiedVehicleMake),
    certifiedVehicleModel:
      data.certifiedVehicleModel === null ||
      data.certifiedVehicleModel === undefined
        ? null
        : String(data.certifiedVehicleModel),
    certifiedVehicleColor:
      data.certifiedVehicleColor === null ||
      data.certifiedVehicleColor === undefined
        ? null
        : String(data.certifiedVehicleColor),
    correctionLog: normalizeCorrectionLog(data.correctionLog),
  };
}

/**
 * Single source of truth for alert shape (Firestore docs + demo JSON).
 */
export function normalizeAlertRecord(
  id: string,
  data: Record<string, unknown>,
): AlertRecord {
  const safeId =
    id || (typeof data.id === "string" ? data.id : String(data.id ?? ""));

  return {
    id: safeId || crypto.randomUUID(),
    alertType: parseAlertType(data.alertType),
    message: String(data.message ?? ""),
    journeyId: String(data.journeyId ?? ""),
    driverEmployeeID: String(data.driverEmployeeID ?? ""),
    createdAt: coerceDate(data.createdAt),
    isResolved: Boolean(data.isResolved),
    resolvedBy:
      data.resolvedBy === null || data.resolvedBy === undefined
        ? null
        : String(data.resolvedBy),
    resolvedAt: coerceDateOrNull(data.resolvedAt),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseJourneyArrayFromSessionJson(raw: string): JourneyRecord[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: JourneyRecord[] = [];
    for (const item of parsed) {
      if (!isPlainObject(item)) continue;
      const id = String(item.id ?? "");
      out.push(normalizeJourneyRecord(id, item));
    }
    return out;
  } catch {
    return [];
  }
}

export function parseAlertArrayFromSessionJson(raw: string): AlertRecord[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AlertRecord[] = [];
    for (const item of parsed) {
      if (!isPlainObject(item)) continue;
      const id = String(item.id ?? "");
      out.push(normalizeAlertRecord(id, item));
    }
    return out;
  } catch {
    return [];
  }
}
