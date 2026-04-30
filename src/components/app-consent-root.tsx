"use client";

import { RegisterServiceWorker } from "@/components/pwa/register-sw";

export function AppConsentRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterServiceWorker />
      {children}
    </>
  );
}
