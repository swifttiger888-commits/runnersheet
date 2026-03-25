"use client";

import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/context/cookie-consent-context";

export function PrivacyCookieActions() {
  const { status, reopenChoice } = useCookieConsent();

  if (status === "loading") {
    return (
      <p className="text-sm text-muted" role="status">
        Loading…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="text-sm text-muted">
        Current:{" "}
        <span className="font-semibold text-foreground">
          {status === "pending"
            ? "Not decided yet"
            : status === "granted"
              ? "Analytics accepted"
              : "Analytics rejected"}
        </span>
      </p>
      <Button
        className="sm:ml-auto"
        onClick={reopenChoice}
        type="button"
        variant="secondary"
      >
        Reset cookie choice
      </Button>
    </div>
  );
}
