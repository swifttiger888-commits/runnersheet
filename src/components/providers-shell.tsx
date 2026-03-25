"use client";

import dynamic from "next/dynamic";

const ClientProviders = dynamic(
  () =>
    import("@/components/client-providers").then((m) => m.ClientProviders),
  { ssr: false },
);

/**
 * Client-only shell so `layout` stays a Server Component while Firebase SDK
 * (protobuf codegen) is not loaded in the Worker bundle.
 */
export function ProvidersShell({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
