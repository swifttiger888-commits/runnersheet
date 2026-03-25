/**
 * Deep links to popular navigation apps using a destination query (UK postcode or address).
 * Opens in the native app when installed; otherwise the web fallback works in the browser.
 */

export type MapsDestinationLinks = {
  googleMaps: string;
  appleMaps: string;
  waze: string;
};

/** TomTom GO expects lat,lng in the deep link, not a free-text address. */
export function buildTomTomGoNavigateDeepLink(lat: number, lng: number): string {
  const dest = `${lat},${lng}`;
  return `tomtomgo://x-callback-url/navigate?destination=${encodeURIComponent(dest)}`;
}

/** Build navigation URLs. `destination` should be a formatted postcode or full address. */
export function buildMapsDestinationLinks(destination: string): MapsDestinationLinks | null {
  const q = destination.trim();
  if (!q) return null;
  const encoded = encodeURIComponent(q);

  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    appleMaps: `https://maps.apple.com/?daddr=${encoded}`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}
