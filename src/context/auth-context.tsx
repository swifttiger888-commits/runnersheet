"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { validateDemoCredentials } from "@/config/demo-auth";
import { getFirebaseClients } from "@/lib/firebase";
import {
  getAuthProviderMode,
  shouldUseFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/auth-config";
import type { UserRole } from "@/types/user";

const DEV_KEY = "runnersheet_dev";

type AuthContextValue = {
  ready: boolean;
  /** Current mode from env. */
  provider: "demo" | "firebase";
  /** Firebase env keys are set (may still be wrong mode). */
  firebaseConfigured: boolean;
  /** True when using Firebase Auth listeners (firebase mode + keys). */
  usesFirebaseAuth: boolean;
  user: User | null;
  role: UserRole | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  devSignIn: (role: UserRole) => Promise<void>;
  clearError: () => void;
  /** Demo role buttons: always in demo mode; in firebase mode only in development. */
  showDemoShortcuts: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readDevRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: string };
    if (parsed.role === "driver" || parsed.role === "manager") {
      return parsed.role;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistDevRole(role: UserRole) {
  sessionStorage.setItem(DEV_KEY, JSON.stringify({ role }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provider = getAuthProviderMode();
  const firebaseConfigured = isFirebaseConfigured();
  const usesFirebaseAuth = shouldUseFirebaseAuth();
  const showDemoShortcuts =
    provider === "demo" ||
    (provider === "firebase" && process.env.NODE_ENV === "development");

  useEffect(() => {
    let cancelled = false;

    if (!usesFirebaseAuth) {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(null);
        setRole(readDevRole());
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const clients = getFirebaseClients();
    if (!clients) {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(null);
        setRole(readDevRole());
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const { auth, db } = clients;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      if (u) {
        sessionStorage.removeItem(DEV_KEY);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          const r = snap.data()?.role as string | undefined;
          const next =
            r === "driver" || r === "manager" ? (r as UserRole) : null;
          setRole(next);
        } catch {
          setRole(null);
        }
      } else {
        setRole(readDevRole());
      }
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [usesFirebaseAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const mode = getAuthProviderMode();

    if (mode === "demo") {
      const r = validateDemoCredentials(email, password);
      if (!r) {
        setError("Invalid email or password for demo sign-in.");
        return;
      }
      persistDevRole(r);
      setUser(null);
      setRole(r);
      return;
    }

    if (!isFirebaseConfigured()) {
      setError(
        "Firebase mode requires .env.local with your Firebase web app keys.",
      );
      return;
    }

    const clients = getFirebaseClients();
    if (!clients) {
      setError("Could not initialize Firebase. Check your configuration.");
      return;
    }
    try {
      await signInWithEmailAndPassword(clients.auth, email, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setError(msg);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    sessionStorage.removeItem(DEV_KEY);
    setUser(null);
    setRole(null);
    const clients = getFirebaseClients();
    if (clients) {
      try {
        await signOut(clients.auth);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const devSignIn = useCallback(
    async (r: UserRole) => {
      const clients = getFirebaseClients();
      if (clients) {
        try {
          await signOut(clients.auth);
        } catch {
          /* ignore */
        }
      }
      persistDevRole(r);
      setUser(null);
      setRole(r);
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      ready,
      provider,
      firebaseConfigured,
      usesFirebaseAuth,
      user,
      role,
      error,
      signIn,
      signOutUser,
      devSignIn,
      clearError,
      showDemoShortcuts,
    }),
    [
      ready,
      provider,
      firebaseConfigured,
      usesFirebaseAuth,
      user,
      role,
      error,
      signIn,
      signOutUser,
      devSignIn,
      clearError,
      showDemoShortcuts,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
