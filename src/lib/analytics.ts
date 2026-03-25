/**
 * GA4 — loads only when `GoogleAnalytics` / gtag is present on the page.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/event-parameters
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackGa4Event(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
}
