"use client";

import { useEffect } from "react";
import { ensureFirebaseClients } from "@/lib/firebase";
import type { UserAccessStatus, UserRole } from "@/types/user";

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * When the PWA runs from the home screen, record install tracking on the user doc
 * (Firestore). Fails silently (offline, rules, missing doc).
 */
export function usePwaInstallTracking(opts: {
  enabled: boolean;
  userId: string | null;
  role: UserRole | null;
  accessStatus: UserAccessStatus | "none" | null;
}): void {
  const { enabled, userId, role, accessStatus } = opts;

  useEffect(() => {
    if (!enabled || !userId || role !== "driver") return;
    if (accessStatus !== "approved") return;
    if (!isStandaloneDisplayMode()) return;

    let cancelled = false;

    void (async () => {
      const clients = await ensureFirebaseClients();
      if (cancelled || !clients) return;
      try {
        const { doc, updateDoc, serverTimestamp } = await import(
          "firebase/firestore"
        );
        await updateDoc(doc(clients.db, "users", userId), {
          isInstalled: true,
          lastInstalledCheck: serverTimestamp(),
        });
      } catch {
        /* silent */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, role, accessStatus]);
}
