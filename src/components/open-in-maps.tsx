"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MapPinned, Navigation } from "lucide-react";
import { buildMapsDestinationLinks, buildTomTomGoNavigateDeepLink } from "@/lib/maps-links";
import { geocodeUkPostcode } from "@/lib/postcodes-io";

type OpenInMapsProps = {
  /** Postcode or address string shown to maps apps */
  destination: string | null | undefined;
  className?: string;
};

/**
 * Explicit actions to open Apple Maps, Google Maps, or Waze with the destination.
 * Does not auto-open; each link opens in a new tab / hands off to the app.
 */
export function OpenInMaps({ destination, className = "" }: OpenInMapsProps) {
  const links = buildMapsDestinationLinks(destination ?? "");
  const [tomTomHref, setTomTomHref] = useState<string | null>(null);
  const [tomTomBusy, setTomTomBusy] = useState(false);

  useEffect(() => {
    const q = (destination ?? "").trim();
    if (!q) {
      queueMicrotask(() => {
        setTomTomHref(null);
        setTomTomBusy(false);
      });
      return;
    }
    const ac = new AbortController();
    queueMicrotask(() => {
      setTomTomBusy(true);
      setTomTomHref(null);
    });
    void geocodeUkPostcode(q, ac.signal)
      .then((ll) => {
        if (ac.signal.aborted || !ll) return;
        setTomTomHref(buildTomTomGoNavigateDeepLink(ll.lat, ll.lng));
      })
      .finally(() => {
        if (!ac.signal.aborted) setTomTomBusy(false);
      });
    return () => ac.abort();
  }, [destination]);

  if (!links) return null;

  const itemClass =
    "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground shadow-card-quiet transition-colors hover:bg-muted-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Navigation className="h-4 w-4 text-primary" aria-hidden />
        Open in Maps
      </p>
      <p className="text-xs text-muted">
        Choose an app — opens in a new tab or switches to the app on your phone.
        TomTom uses your destination postcode to find coordinates, then opens
        TomTom GO / Expert if installed.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <a
          className={itemClass}
          href={links.appleMaps}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MapPinned className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Apple Maps
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </a>
        <a
          className={itemClass}
          href={links.googleMaps}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MapPinned className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Google Maps
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </a>
        <a
          className={itemClass}
          href={links.waze}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MapPinned className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Waze
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </a>
        {tomTomBusy ? (
          <span
            className={`${itemClass} cursor-wait opacity-80`}
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            TomTom…
          </span>
        ) : tomTomHref ? (
          <a
            className={itemClass}
            href={tomTomHref}
            rel="noopener noreferrer"
            target="_blank"
            aria-label="Open in TomTom navigation"
          >
            <MapPinned className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            TomTom
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
