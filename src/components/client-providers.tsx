"use client";

import { AuthProvider } from "@/context/auth-context";
import { JourneyDataProvider } from "@/context/journey-data-context";
import { SessionBranchProvider } from "@/context/session-branch-context";

/**
 * Loaded only on the client (`layout` uses `dynamic(..., { ssr: false })`) so the
 * Cloudflare Worker never evaluates `firebase/firestore` / protobufjs.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SessionBranchProvider>
        <JourneyDataProvider>{children}</JourneyDataProvider>
      </SessionBranchProvider>
    </AuthProvider>
  );
}
