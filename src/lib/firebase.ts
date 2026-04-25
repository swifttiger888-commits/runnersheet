import { isFirebaseConfigured } from "@/lib/firebase-env";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseClients | null | undefined;
let persistenceInitPromise: Promise<void> | null = null;
let authPersistenceInitPromise: Promise<void> | null = null;

/**
 * Load Firebase SDK modules (dynamic import only — required for Cloudflare Workers,
 * which forbid `new Function` / protobuf codegen in the server bundle).
 */
export async function ensureFirebaseClients(): Promise<FirebaseClients | null> {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (cached !== undefined) return cached;

  const [
    { initializeApp, getApps },
    {
      browserLocalPersistence,
      getAuth,
      indexedDBLocalPersistence,
      inMemoryPersistence,
      setPersistence,
    },
    { enableMultiTabIndexedDbPersistence, getFirestore },
  ] =
    await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);

  const app = getApps().length ? getApps()[0]! : initializeApp(config);
  cached = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
  const authClient = cached.auth;

  if (!authPersistenceInitPromise) {
    // Keep users signed in across browser restarts where possible.
    authPersistenceInitPromise = setPersistence(
      authClient,
      indexedDBLocalPersistence,
    )
      .catch(() => setPersistence(authClient, browserLocalPersistence))
      .catch(() => setPersistence(authClient, inMemoryPersistence))
      .catch(() => {
        /* No-op: auth will still work even if explicit persistence cannot be set. */
      });
  }
  await authPersistenceInitPromise;

  if (!persistenceInitPromise) {
    persistenceInitPromise = enableMultiTabIndexedDbPersistence(cached.db).catch(
      () => {
        /* No-op: persistence may be unavailable (private mode, unsupported browser, etc). */
      },
    );
  }
  await persistenceInitPromise;
  return cached;
}

/** Populated after the first successful `ensureFirebaseClients()` on the client. */
export function getFirebaseClients(): FirebaseClients | null {
  if (typeof window === "undefined") return null;
  return cached ?? null;
}

export { isFirebaseConfigured } from "@/lib/firebase-env";
