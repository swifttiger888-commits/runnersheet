import { isFirebaseConfigured } from "@/lib/firebase-env";

export type AuthProviderMode = "demo" | "firebase";

/**
 * `NEXT_PUBLIC_AUTH_PROVIDER=demo` — session via demo credentials / shortcuts only; no Firebase Auth listeners.
 * `NEXT_PUBLIC_AUTH_PROVIDER=firebase` — Firebase Auth + Firestore `users/{uid}.role`.
 */
export function getAuthProviderMode(): AuthProviderMode {
  return "firebase";
}

export function shouldUseFirebaseAuth(): boolean {
  return getAuthProviderMode() === "firebase" && isFirebaseConfigured();
}

/** Firebase keys present (independent of auth mode). */
export { isFirebaseConfigured } from "@/lib/firebase-env";
