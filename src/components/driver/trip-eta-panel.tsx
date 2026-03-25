"use client";

import { Loader2, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HybridTripEta } from "@/hooks/use-hybrid-trip-eta";

type TripEtaPanelProps = {
  eta: HybridTripEta;
  /** Show location controls (browser Geolocation). */
  showLocationControls: boolean;
};

export function TripEtaPanel({
  eta,
  showLocationControls,
}: TripEtaPanelProps) {
  const {
    rangeLabel,
    originHint,
    destinationLoading,
    destinationUnavailable,
    branchOriginLoading,
    gpsStatus,
    requestLocation,
    clearLocation,
  } = eta;

  const canUseGps =
    showLocationControls &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.geolocation);

  const showGpsRow =
    canUseGps &&
    !destinationUnavailable &&
    (destinationLoading || Boolean(rangeLabel));

  if (
    !destinationLoading &&
    !destinationUnavailable &&
    !rangeLabel &&
    !originHint &&
    !branchOriginLoading
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/80 bg-muted-bg/35 px-3 py-2.5">
      {branchOriginLoading ? (
        <p className="mb-2 flex items-center gap-2 text-sm text-muted">
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            aria-hidden
          />
          Looking up branch location…
        </p>
      ) : null}

      {destinationLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            aria-hidden
          />
          Looking up destination…
        </p>
      ) : null}

      {destinationUnavailable ? (
        <p className="text-sm text-muted" role="status">
          Couldn&apos;t verify that postcode, so no driving-time estimate.
        </p>
      ) : null}

      {rangeLabel ? (
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {rangeLabel}{" "}
            <span className="font-normal text-muted">driving (estimate)</span>
          </p>
          {originHint ? (
            <p className="text-xs leading-snug text-muted">{originHint}</p>
          ) : null}
        </div>
      ) : null}

      {showGpsRow ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {gpsStatus !== "granted" ? (
            <Button
              className="min-h-10 gap-1.5"
              disabled={gpsStatus === "loading"}
              onClick={requestLocation}
              type="button"
              variant="secondary"
            >
              {gpsStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Navigation className="h-4 w-4" aria-hidden />
              )}
              Use my location
            </Button>
          ) : (
            <Button
              className="min-h-10 gap-1.5"
              onClick={clearLocation}
              type="button"
              variant="ghost"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Use branch only
            </Button>
          )}
          {gpsStatus === "denied" ? (
            <span className="text-xs text-muted">
              Location blocked — estimate uses your branch.
            </span>
          ) : null}
          {gpsStatus === "unavailable" ? (
            <span className="text-xs text-muted">
              Location not available on this device.
            </span>
          ) : null}
          {gpsStatus === "error" ? (
            <span className="text-xs text-muted">
              Couldn&apos;t read location — try again or use branch.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
