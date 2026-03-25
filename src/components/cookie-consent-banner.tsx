"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/context/cookie-consent-context";

/**
 * Slim bottom strip — equal-weight actions, RunnerSheet tokens (no stock CMP chrome).
 */
export function CookieConsentBanner() {
  const { status, grant, deny } = useCookieConsent();

  if (status !== "pending") return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-overlay border-t border-border/80 bg-surface-elevated/95 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 gap-2.5">
          <Cookie
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            aria-hidden
          />
          <p className="text-sm leading-snug text-foreground">
            We use optional analytics to see how RunnerSheet is used (visits and
            key actions). No ads.{" "}
            <Link
              className="font-semibold text-primary underline-offset-2 hover:underline"
              href="/privacy"
            >
              Privacy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button
            className="min-w-30"
            onClick={deny}
            type="button"
            variant="secondary"
          >
            Reject
          </Button>
          <Button
            className="min-w-30"
            onClick={grant}
            type="button"
            variant="secondary"
          >
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
