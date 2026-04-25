"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import { ensureFirebaseClients } from "@/lib/firebase";
import {
  getAuthProviderMode,
  shouldUseFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/auth-config";
import { isCompanyEmailAllowed } from "@/lib/company-email";
import { migrateProvisionedDriverProfile } from "@/lib/link-provisioned-driver";
import { parseFirestoreUser } from "@/lib/parse-firestore-user";
import { usePwaInstallTracking } from "@/hooks/use-pwa-install-tracking";
import { getSiteUrl } from "@/lib/site";
import type { UserAccessStatus, UserProfile, UserRole } from "@/types/user";

/** Extensible OAuth entry points (Firebase console must enable each provider). */
export type OAuthProviderId = "google";

function mapFirebaseAuthError(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-closed-by-user")
      return "Sign-in was cancelled.";
    if (code === "auth/cancelled-popup-request")
      return "Another sign-in is already in progress.";
  }
  return e instanceof Error ? e.message : "Sign-in failed.";
}

function mapPasswordResetError(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/invalid-email") return "Enter a valid email address.";
    if (code === "auth/too-many-requests")
      return "Too many attempts. Wait a few minutes, then try again.";
  }
  return e instanceof Error ? e.message : "Could not send reset email.";
}

function mapFirebaseSignUpError(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-in-use")
      return "An account already exists for this email. Sign in instead.";
    if (code === "auth/weak-password")
      return "Use a stronger password (Firebase needs at least 6 characters).";
    if (code === "auth/invalid-email") return "Enter a valid email address.";
  }
  return e instanceof Error ? e.message : "Could not create account.";
}

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
  /**
   * Firestore access gate (Firebase mode only). `null` before first read or when signed out.
   * `none` = signed in but no approved profile yet (request access).
   */
  accessStatus: UserAccessStatus | "none" | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Firebase: create Email/Password user so non–Google users can sign in and request access. */
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  /**
   * Firebase: send password reset email. Same ambiguous success if the user does not exist
   * (avoids email enumeration).
   */
  requestPasswordReset: (email: string) => Promise<
    { outcome: "sent" } | { outcome: "error"; message: string }
  >;
  signInWithOAuth: (providerId: OAuthProviderId) => Promise<void>;
  signOutUser: () => Promise<void>;
  devSignIn: (role: UserRole) => Promise<void>;
  clearError: () => void;
  /** Demo shortcuts are disabled in production auth mode. */
  showDemoShortcuts: boolean;
  /** Profile from Firestore users/{uid} or demo profile */
  profile: UserProfile | null;
  /** Submit first-time access request (creates users/{uid} with accessStatus pending). */
  submitAccessRequest: (input: {
    name: string;
    employeeId: string;
    homeBranch: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<
    UserAccessStatus | "none" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const provider = getAuthProviderMode();
  const firebaseConfigured = isFirebaseConfigured();
  const usesFirebaseAuth = shouldUseFirebaseAuth();
  const showDemoShortcuts = false;

  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;

    if (!usesFirebaseAuth) {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(null);
        setAccessStatus(null);
        setRole(null);
        setProfile(null);
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const clients = await ensureFirebaseClients();
      if (cancelled) return;
      if (!clients) {
        queueMicrotask(() => {
          if (cancelled) return;
          setUser(null);
          setAccessStatus(null);
          setRole(null);
          setProfile(null);
          setReady(true);
        });
        return;
      }

      const [{ onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);

      if (cancelled) return;

      const { auth, db } = clients;
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        if (cancelled) return;
        setUser(u);
        if (u) {
          // Avoid showing stale UI (ready=true, accessStatus=null) while Firestore loads.
          if (!cancelled) setReady(false);

          try {
            let profileSnap = await getDoc(doc(db, "users", u.uid));
            if (!profileSnap.exists() && u.email) {
              const migrated = await migrateProvisionedDriverProfile(db, u);
              if (migrated) {
                profileSnap = await getDoc(doc(db, "users", u.uid));
              }
            }
            const parsed = parseFirestoreUser(
              profileSnap.data() as Record<string, unknown> | undefined,
            );

            const superApproved =
              parsed.accessStatus === "approved" &&
              parsed.role === "super-admin";

            if (!superApproved && !isCompanyEmailAllowed(u.email)) {
              try {
                const { signOut } = await import("firebase/auth");
                await signOut(clients.auth);
              } catch {
                /* ignore */
              }
              setError(
                "This email address can’t be used to sign in. Try the address on your RunnerSheet profile, or contact your manager.",
              );
              setUser(null);
              setRole(null);
              setProfile(null);
              setAccessStatus(null);
              if (!cancelled) setReady(true);
              return;
            }

            setAccessStatus(parsed.accessStatus);

            if (parsed.accessStatus === "approved") {
              setRole(parsed.role);
              setProfile(
                parsed.profile ?? {
                  name: String(u.displayName ?? "User"),
                  employeeId: "",
                  homeBranch: "Leeds",
                },
              );
            } else {
              setRole(null);
              setProfile(parsed.profile);
            }
          } catch {
            setRole(null);
            setProfile(null);
            setAccessStatus("none");
          }
        } else {
          setAccessStatus(null);
          setRole(null);
          setProfile(null);
        }
        if (!cancelled) setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      unsubAuth?.();
    };
  }, [usesFirebaseAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);

    if (!isFirebaseConfigured()) {
      setError(
        "Sign-in isn’t configured on this device. Check with your administrator.",
      );
      return;
    }

    if (!isCompanyEmailAllowed(email.trim())) {
      setError(
        "This email address can’t be used to sign in here. Try the address registered for your account.",
      );
      return;
    }

    const clients = await ensureFirebaseClients();
    if (!clients) {
      setError("Couldn’t connect to sign-in. Try again or contact your administrator.");
      return;
    }
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(clients.auth, email.trim(), password);
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    if (getAuthProviderMode() !== "firebase") {
      setError("Email sign-up isn’t available in this setup.");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError(
        "Sign-in isn’t configured on this device. Check with your administrator.",
      );
      return;
    }
    const trimmed = email.trim();
    if (!isCompanyEmailAllowed(trimmed)) {
      setError(
        "This email address can’t be used here. Use the address your organisation uses for RunnerSheet.",
      );
      return;
    }
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setError(
        "Couldn’t connect to sign-in. Try again or contact your administrator.",
      );
      return;
    }
    try {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      await createUserWithEmailAndPassword(clients.auth, trimmed, password);
    } catch (e) {
      setError(mapFirebaseSignUpError(e));
    }
  }, []);

  const requestPasswordReset = useCallback(
    async (
      email: string,
    ): Promise<{ outcome: "sent" } | { outcome: "error"; message: string }> => {
      if (getAuthProviderMode() !== "firebase") {
        return {
          outcome: "error",
          message: "Password reset isn’t available in this setup.",
        };
      }
      if (!isFirebaseConfigured()) {
        return {
          outcome: "error",
          message:
            "Sign-in isn’t configured on this device. Check with your administrator.",
        };
      }
      const trimmed = email.trim();
      if (!trimmed) {
        return { outcome: "error", message: "Enter your email address." };
      }
      if (!isCompanyEmailAllowed(trimmed)) {
        return {
          outcome: "error",
          message:
            "This email address can’t be used here. Use the address your organisation uses for RunnerSheet.",
        };
      }
      const clients = await ensureFirebaseClients();
      if (!clients) {
        return {
          outcome: "error",
          message:
            "Couldn’t connect. Try again or contact your administrator.",
        };
      }
      try {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(clients.auth, trimmed, {
          url: `${getSiteUrl()}/login`,
          handleCodeInApp: false,
        });
        return { outcome: "sent" };
      } catch (e) {
        const code =
          e && typeof e === "object" && "code" in e
            ? (e as { code?: string }).code
            : "";
        if (code === "auth/user-not-found") {
          return { outcome: "sent" };
        }
        return { outcome: "error", message: mapPasswordResetError(e) };
      }
    },
    [],
  );

  const signInWithOAuth = useCallback(async (providerId: OAuthProviderId) => {
    setError(null);
    if (getAuthProviderMode() !== "firebase") {
      setError("Google sign-in isn’t available in this setup.");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError(
        "Sign-in isn’t configured on this device. Check with your administrator.",
      );
      return;
    }
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setError("Couldn’t connect to sign-in. Try again or contact your administrator.");
      return;
    }
    try {
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } =
        await import("firebase/auth");
      if (providerId === "google") {
        const google = new GoogleAuthProvider();
        google.addScope("profile");
        google.addScope("email");
        google.setCustomParameters({ prompt: "select_account" });
        try {
          await signInWithPopup(clients.auth, google);
        } catch (popupErr) {
          const code =
            popupErr && typeof popupErr === "object" && "code" in popupErr
              ? String((popupErr as { code?: string }).code ?? "")
              : "";
          // Some embedded/mobile browsers block popup windows; fall back to redirect auth.
          if (
            code === "auth/popup-blocked" ||
            code === "auth/web-storage-unsupported" ||
            code === "auth/operation-not-supported-in-this-environment"
          ) {
            await signInWithRedirect(clients.auth, google);
            return;
          }
          throw popupErr;
        }
        return;
      }
      setError("Unsupported OAuth provider.");
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    }
  }, []);

  const submitAccessRequest = useCallback(
    async (input: { name: string; employeeId: string; homeBranch: string }) => {
      setError(null);
      const clients = await ensureFirebaseClients();
      if (!clients || !user) {
        setError("Sign in again, then submit your request.");
        return;
      }
      const name = input.name.trim();
      if (!name) {
        setError("Enter your name.");
        return;
      }
      try {
        const { doc, setDoc, serverTimestamp } = await import(
          "firebase/firestore"
        );
        await setDoc(
          doc(clients.db, "users", user.uid),
          {
            accessStatus: "pending",
            name,
            employeeId: input.employeeId.trim(),
            homeBranch: input.homeBranch.trim() || "Leeds",
            email: user.email ?? "",
            requestedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setAccessStatus("pending");
        setProfile({
          name,
          employeeId: input.employeeId.trim(),
          homeBranch: input.homeBranch.trim() || "Leeds",
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not submit access request.",
        );
      }
    },
    [user],
  );

  const signOutUser = useCallback(async () => {
    setUser(null);
    setRole(null);
    setProfile(null);
    setAccessStatus(null);
    const clients = await ensureFirebaseClients();
    if (clients) {
      try {
        const { signOut } = await import("firebase/auth");
        await signOut(clients.auth);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const devSignIn = useCallback(
    async (r: UserRole) => {
      void r;
      setError("Demo shortcuts are disabled. Sign in with your RunnerSheet account.");
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
      accessStatus,
      error,
      signIn,
      signUpWithEmail,
      requestPasswordReset,
      signInWithOAuth,
      signOutUser,
      devSignIn,
      clearError,
      showDemoShortcuts,
      profile,
      submitAccessRequest,
    }),
    [
      ready,
      provider,
      firebaseConfigured,
      usesFirebaseAuth,
      user,
      role,
      accessStatus,
      profile,
      error,
      signIn,
      signUpWithEmail,
      requestPasswordReset,
      signInWithOAuth,
      signOutUser,
      devSignIn,
      clearError,
      showDemoShortcuts,
      submitAccessRequest,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <PwaInstallTracking />
      {children}
    </AuthContext.Provider>
  );
}

function PwaInstallTracking() {
  const { ready, usesFirebaseAuth, user, role, accessStatus } = useAuth();
  usePwaInstallTracking({
    enabled: ready && usesFirebaseAuth,
    userId: user?.uid ?? null,
    role,
    accessStatus,
  });
  return null;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
