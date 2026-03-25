"use client";

import {
  CookieConsentProvider,
  useCookieConsent,
} from "@/context/cookie-consent-context";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

function ConsentMain({ children }: { children: React.ReactNode }) {
  const { status } = useCookieConsent();
  const padBottom =
    status === "pending"
      ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      : undefined;
  return (
    <div className={padBottom}>
      {children}
    </div>
  );
}

export function AppConsentRoot({ children }: { children: React.ReactNode }) {
  return (
    <CookieConsentProvider>
      <RegisterServiceWorker />
      <GoogleAnalytics />
      <ConsentMain>{children}</ConsentMain>
      <CookieConsentBanner />
    </CookieConsentProvider>
  );
}
