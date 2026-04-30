import type { JourneyCorrectionReason } from "@/types/journey";

export const JOURNEY_CORRECTION_REASON_OPTIONS: ReadonlyArray<{
  value: JourneyCorrectionReason;
  label: string;
}> = [
  { value: "forgot_to_end", label: "Forgot to end journey" },
  { value: "forgot_to_start", label: "Forgot to start journey" },
  { value: "app_issue", label: "App/phone issue" },
  { value: "other", label: "Other" },
] as const;

/** Max length for optional driver correction notes (Firestore + UI safety). */
export const JOURNEY_CORRECTION_NOTE_MAX_CHARS = 500;

/** Trim and cap length; returns null if empty after trim. */
export function clampCorrectionNote(note: string | undefined | null): string | null {
  const t = typeof note === "string" ? note.trim() : "";
  if (!t) return null;
  if (t.length <= JOURNEY_CORRECTION_NOTE_MAX_CHARS) return t;
  return t.slice(0, JOURNEY_CORRECTION_NOTE_MAX_CHARS);
}

export function correctionReasonLabel(reason: JourneyCorrectionReason): string {
  const row = JOURNEY_CORRECTION_REASON_OPTIONS.find((r) => r.value === reason);
  return row?.label ?? reason;
}

export function canDriverCorrectJourneyUntil5pm(startTime: Date, now: Date = new Date()): {
  allowed: boolean;
  reason?: string;
} {
  if (startTime.toDateString() !== now.toDateString()) {
    return { allowed: false, reason: "Only same-day journeys can be corrected." };
  }
  const cutoff = new Date(now);
  cutoff.setHours(17, 0, 0, 0);
  if (now >= cutoff) {
    return { allowed: false, reason: "Journey corrections close at 5:00 PM." };
  }
  return { allowed: true };
}
