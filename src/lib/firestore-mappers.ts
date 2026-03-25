import { normalizeAlertRecord, normalizeJourneyRecord } from "@/lib/normalize-records";

/**
 * Map Firestore document data to UI records (normalization + guards live in
 * {@link normalizeJourneyRecord} / {@link normalizeAlertRecord}).
 */
export function mapJourneyDoc(id: string, data: Record<string, unknown>) {
  return normalizeJourneyRecord(id, data);
}

export function mapAlertDoc(id: string, data: Record<string, unknown>) {
  return normalizeAlertRecord(id, data);
}
