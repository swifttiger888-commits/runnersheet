"use client";

import Script from "next/script";
import { useCookieConsent } from "@/context/cookie-consent-context";

/**
 * GA4 — only loads after the user accepts analytics cookies.
 * Measurement ID from `NEXT_PUBLIC_GA_MEASUREMENT_ID` or
 * `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`.
 */
export function GoogleAnalytics() {
  const { status } = useCookieConsent();
  const id =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  if (!id || status !== "granted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
`}
      </Script>
    </>
  );
}
