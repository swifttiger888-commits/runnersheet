/** Canonical site origin — set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://runnersheet.win). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://runnersheet.win";
  return raw.replace(/\/$/, "");
}
