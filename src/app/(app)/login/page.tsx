"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  Briefcase,
  Car,
  Home,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  Shield,
  UserPlus,
} from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { InstallPWA } from "@/components/install-pwa";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useBranches } from "@/context/branches-context";
import { DEMO_ACCOUNT_HINT } from "@/config/demo-auth";
import type { UserRole } from "@/types/user";

const branchSelectClassName =
  "min-h-11 w-full cursor-pointer rounded-xl border border-border/90 bg-background px-3.5 py-2.5 text-foreground shadow-inset-field outline-none transition-[box-shadow,border-color] duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signInAs = searchParams.get("as");
  const isManagerIntent = signInAs === "manager";
  const isDriverIntent = signInAs === "driver";
  const { branchNames, loading: branchesLoading } = useBranches();
  const {
    ready,
    provider,
    firebaseConfigured,
    usesFirebaseAuth,
    user,
    role,
    accessStatus,
    signIn,
    signUpWithEmail,
    requestPasswordReset,
    signInWithOAuth,
    signOutUser,
    devSignIn,
    error,
    clearError,
    showDemoShortcuts,
    submitAccessRequest,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmployeeId, setReqEmployeeId] = useState("");
  const [reqBranch, setReqBranch] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  /** Email path: existing account vs new Firebase Email/Password user (no Google). */
  const [emailAuthMode, setEmailAuthMode] = useState<"signin" | "signup">(
    "signin",
  );
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [passwordResetNotice, setPasswordResetNotice] = useState<string | null>(
    null,
  );
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (!ready || !role) return;
    if (role === "manager") router.replace("/manager");
    else if (role === "super-admin") router.replace("/admin/master");
    else router.replace("/driver");
  }, [ready, role, router]);

  /** Keep selection valid when Firestore branch list replaces fallbacks. */
  const validReqBranch =
    reqBranch && branchNames.length > 0 && !branchNames.includes(reqBranch)
      ? ""
      : reqBranch;

  async function handlePasswordReset() {
    clearError();
    setInlineError(null);
    setPasswordResetNotice(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setInlineError("Enter your email address first, then tap Forgot password.");
      return;
    }
    setResetBusy(true);
    const r = await requestPasswordReset(trimmed);
    setResetBusy(false);
    if (r.outcome === "sent") {
      setPasswordResetNotice(
        "If an account exists for that email, check your inbox for a reset link.",
      );
    } else {
      setInlineError(r.message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setInlineError(null);
    setPasswordResetNotice(null);
    if (emailAuthMode === "signup") {
      if (password !== passwordConfirm) {
        setInlineError("Passwords don’t match.");
        return;
      }
      if (password.length < 6) {
        setInlineError("Use at least 6 characters for your password.");
        return;
      }
      setBusy(true);
      await signUpWithEmail(email.trim(), password);
      setBusy(false);
      return;
    }
    setBusy(true);
    await signIn(email.trim(), password);
    setBusy(false);
  }

  async function onGoogleSignIn() {
    clearError();
    setOauthBusy(true);
    await signInWithOAuth("google");
    setOauthBusy(false);
  }

  async function goDemo(r: UserRole) {
    clearError();
    await devSignIn(r);
    router.push(r === "manager" ? "/manager" : "/driver");
  }

  if (!ready) {
    return (
      <AppShell showBrand>
        <LoadingScreen label="Preparing sign-in…" />
      </AppShell>
    );
  }

  const showFirebaseForm = provider === "firebase" && firebaseConfigured;
  const showFirebaseMisconfigured =
    provider === "firebase" && !firebaseConfigured;
  const showDemoForm = provider === "demo";
  /** Hide Google/email when already signed in (access request / pending / etc.). */
  const showFirebaseSignInForm = showFirebaseForm && !user;

  return (
    <AppShell showBrand>
      <InstallPWA />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isManagerIntent
            ? "Manager sign in"
            : isDriverIntent
              ? "Driver sign in"
              : "Sign in"}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          <strong className="font-semibold text-foreground">RunnerSheet</strong>{" "}
          is for drivers and managers. It is an independent app and is not
          affiliated with or endorsed by Arnold Clark.
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          {isManagerIntent ? (
            <>
              Sign in with the account your admin linked to a{" "}
              <strong className="font-semibold">manager</strong> profile. You’ll
              land on the manager dashboard with alerts, reports, and Magic
              Search for journeys.
            </>
          ) : isDriverIntent ? (
            <>
              Sign in with the account linked to your{" "}
              <strong className="font-semibold">driver</strong> profile to start
              and end jobs, with DVLA plate checks where enabled.
            </>
          ) : (
            <>
              Sign in with your work email. Your role (driver or manager) comes
              from your RunnerSheet profile in Firestore.
            </>
          )}
        </p>
      </div>

      {showFirebaseMisconfigured ? (
        <Card className="border-primary/25 bg-primary/6">
          <div className="flex gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <div className="text-sm text-foreground">
              <p className="font-semibold">Firebase keys missing</p>
              <p className="mt-1 opacity-90">
                Copy{" "}
                <code className="rounded-lg bg-muted-bg/80 px-1.5 py-0.5 font-mono text-xs text-foreground">
                  env.template
                </code>{" "}
                to{" "}
                <code className="rounded-lg bg-muted-bg/80 px-1.5 py-0.5 font-mono text-xs text-foreground">
                  .env.local
                </code>{" "}
                with your Firebase web app config and{" "}
                <code className="rounded-lg bg-muted-bg/80 px-1.5 py-0.5 font-mono text-xs text-foreground">
                  NEXT_PUBLIC_AUTH_PROVIDER=firebase
                </code>
                .
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {usesFirebaseAuth && user && accessStatus === "pending" ? (
        <Card className="border-primary/30 bg-primary/6">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 text-sm text-foreground">
              <p className="font-semibold">Access pending approval</p>
              <p className="mt-1 text-muted">
                Your request was submitted. A manager will review it before you
                can use RunnerSheet. You&apos;ll need to sign in again after
                approval.
              </p>
              <Button
                variant="secondary"
                className="mt-3 gap-2"
                onClick={() => signOutUser()}
                type="button"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {usesFirebaseAuth && user && accessStatus === "rejected" ? (
        <Card className="border-danger/40 bg-danger-bg">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 text-sm text-foreground">
              <p className="font-semibold">Access not granted</p>
              <p className="mt-1 text-muted">
                Your request was not approved. Contact your manager if this is
                a mistake.
              </p>
              <Button
                variant="secondary"
                className="mt-3 gap-2"
                onClick={() => signOutUser()}
                type="button"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {usesFirebaseAuth && user && accessStatus === "none" && !role ? (
        <Card className="border-border">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1 text-sm text-foreground">
              <p className="font-semibold">Request access</p>
              <p className="mt-1 text-muted">
                Your account is not set up yet. Submit your details for a manager
                to approve. Use the same email you&apos;ll use to sign in to
                RunnerSheet.
              </p>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  clearError();
                  setReqBusy(true);
                  void submitAccessRequest({
                    name: reqName,
                    employeeId: reqEmployeeId,
                    homeBranch: validReqBranch,
                  }).finally(() => setReqBusy(false));
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-name">Full name</Label>
                  <Input
                    id="req-name"
                    autoComplete="name"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-emp">Employee ID</Label>
                  <Input
                    id="req-emp"
                    value={reqEmployeeId}
                    onChange={(e) => setReqEmployeeId(e.target.value)}
                    placeholder="Employee ID"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-branch">Home branch</Label>
                  {branchNames.length === 0 && !branchesLoading ? (
                    <p className="text-sm text-danger" role="alert">
                      No branches are set up yet. Ask a manager to add branches
                      in RunnerSheet, then refresh this page.
                    </p>
                  ) : (
                    <select
                      id="req-branch"
                      required
                      value={validReqBranch}
                      onChange={(e) => setReqBranch(e.target.value)}
                      className={branchSelectClassName}
                      disabled={reqBusy}
                    >
                      <option value="">Select branch</option>
                      {branchNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-muted">
                    Choose from the list so your branch matches everyone else’s
                    records.
                  </p>
                </div>
                {error ? (
                  <p className="text-sm font-medium text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    className="gap-2"
                    disabled={reqBusy || branchNames.length === 0}
                  >
                    {reqBusy ? "Submitting…" : "Submit request"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => signOutUser()}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>
      ) : null}

      {showDemoForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              Email sign-in
            </CardTitle>
            <p className="mt-1 text-sm text-muted">{DEMO_ACCOUNT_HINT}</p>
          </CardHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                inputMode="email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@demo.runnersheet"
                type="email"
                value={email}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                value={password}
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button disabled={busy} type="submit" className="w-full gap-2">
              <LogIn className="h-4 w-4" aria-hidden />
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      ) : null}

      {showFirebaseSignInForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              {emailAuthMode === "signup" ? "Email account" : "Sign in"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              {emailAuthMode === "signin"
                ? "After you sign in, you can request access if your manager hasn’t set you up yet."
                : "No Google account? Create a password here — then you can request access from a manager."}
            </p>
          </CardHeader>
          <div className="flex flex-col gap-4">
            <GoogleSignInButton
              busy={oauthBusy}
              disabled={busy}
              onClick={() => void onGoogleSignIn()}
            />
            <div className="relative py-0.5" role="separator">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden
              >
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface px-2 text-xs font-medium uppercase tracking-wide text-muted">
                  or email
                </span>
              </div>
            </div>
            <div
              className="flex rounded-xl border border-border bg-muted-bg/30 p-1"
              role="tablist"
              aria-label="Email sign-in or create account"
            >
              <button
                type="button"
                role="tab"
                aria-selected={emailAuthMode === "signin"}
                className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
                  emailAuthMode === "signin"
                    ? "bg-surface-elevated text-foreground shadow-card-quiet"
                    : "text-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setEmailAuthMode("signin");
                  setInlineError(null);
                  setPasswordResetNotice(null);
                  clearError();
                  setPasswordConfirm("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={emailAuthMode === "signup"}
                className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
                  emailAuthMode === "signup"
                    ? "bg-surface-elevated text-foreground shadow-card-quiet"
                    : "text-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setEmailAuthMode("signup");
                  setInlineError(null);
                  setPasswordResetNotice(null);
                  clearError();
                  setPasswordConfirm("");
                }}
              >
                Create account
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fb-email">Email</Label>
                <Input
                  autoComplete="email"
                  id="fb-email"
                  inputMode="email"
                  name="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInlineError(null);
                    setPasswordResetNotice(null);
                  }}
                  type="email"
                  value={email}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fb-password">Password</Label>
                <Input
                  autoComplete={
                    emailAuthMode === "signup" ? "new-password" : "current-password"
                  }
                  id="fb-password"
                  name="password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setInlineError(null);
                  }}
                  type="password"
                  value={password}
                />
              </div>
              {emailAuthMode === "signin" ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                    disabled={busy || oauthBusy || resetBusy}
                    onClick={() => void handlePasswordReset()}
                  >
                    {resetBusy ? "Sending…" : "Forgot password?"}
                  </button>
                </div>
              ) : null}
              {emailAuthMode === "signup" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fb-password-confirm">Confirm password</Label>
                  <Input
                    autoComplete="new-password"
                    id="fb-password-confirm"
                    name="password-confirm"
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value);
                      setInlineError(null);
                    }}
                    type="password"
                    value={passwordConfirm}
                  />
                  <p className="text-xs leading-relaxed text-muted">
                    Minimum length and complexity can be enforced in your Firebase
                    project (Authentication → settings). This app doesn’t add a
                    separate password challenge beyond that.
                  </p>
                </div>
              ) : null}
              {passwordResetNotice ? (
                <p className="text-sm text-foreground" role="status">
                  {passwordResetNotice}
                </p>
              ) : null}
              {inlineError || error ? (
                <p className="text-sm font-medium text-danger" role="alert">
                  {inlineError ?? error}
                </p>
              ) : null}
              <Button
                disabled={busy || oauthBusy || resetBusy}
                type="submit"
                className="w-full gap-2"
              >
                {emailAuthMode === "signup" ? (
                  <UserPlus className="h-4 w-4" aria-hidden />
                ) : (
                  <LogIn className="h-4 w-4" aria-hidden />
                )}
                {busy
                  ? emailAuthMode === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : emailAuthMode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      {showDemoShortcuts ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Quick entry</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {provider === "firebase"
                ? "Shortcut for local development — opens without a full sign-in."
                : "Jump straight into a role."}
            </p>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="min-w-36 flex-1 gap-2"
              onClick={() => goDemo("driver")}
              type="button"
            >
              <Car className="h-4 w-4 shrink-0" aria-hidden />
              Continue as driver
            </Button>
            <Button
              variant="secondary"
              className="min-w-36 flex-1 gap-2"
              onClick={() => goDemo("manager")}
              type="button"
            >
              <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
              Continue as manager
            </Button>
          </div>
        </Card>
      ) : null}

      <p className="text-center text-sm text-muted">
        <Link
          className="inline-flex items-center justify-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          href="/"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          Back to home
        </Link>
      </p>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AppShell showBrand>
          <LoadingScreen label="Preparing sign-in…" />
        </AppShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
