/** Human-readable duration from start time to now (for active journeys). */
export function formatRunningDuration(start: Date, nowMs: number = Date.now()): string {
  const ms = Math.max(0, nowMs - start.getTime());
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `Running ${h}h ${m}m`;
  return `Running ${m} min`;
}
