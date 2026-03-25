/**
 * UK vehicle registration + postcode formatting for input/display.
 * Plates: common post-2001 pattern LLNNLLL → "LLNN LLL".
 * Postcodes: split outward / inward when the last 3 chars look like a UK inward code.
 */

/** Letters and digits only, uppercased. */
export function sanitizeAlphanumericUpper(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Modern UK plate (2001+): two letters, two numbers, three letters.
 * e.g. AB12CDE → AB12 CDE
 */
const REG_MODERN_SEVEN = /^[A-Z]{2}\d{2}[A-Z]{3}$/;

export function formatUkVehicleRegistration(raw: string): string {
  const s = sanitizeAlphanumericUpper(raw);
  if (REG_MODERN_SEVEN.test(s)) {
    return `${s.slice(0, 4)} ${s.slice(4)}`;
  }
  return s;
}

/** UK inward code is typically one digit + two letters (e.g. 9BG, 1AA). */
const INWARD_LIKE = /^\d[A-Z]{2}$/;

/**
 * Formats a full or nearly-full postcode without spaces, e.g. WF179BG → WF17 9BG.
 * Avoids splitting short/partial strings where the last 3 chars aren't a plausible inward code.
 */
export function formatUkPostcode(raw: string): string {
  const cleaned = sanitizeAlphanumericUpper(raw);
  if (cleaned.length < 5) return cleaned;
  const inward = cleaned.slice(-3);
  if (!INWARD_LIKE.test(inward)) return cleaned;
  const outward = cleaned.slice(0, -3);
  if (outward.length < 2) return cleaned;
  return `${outward} ${inward}`;
}
