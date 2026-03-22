"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Info, KeyRound, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { DEMO_ACCOUNT_HINT } from "@/config/demo-auth";
import type { UserRole } from "@/types/user";

export default function LoginPage() {
  const router = useRouter();
  const {
    ready,
    provider,
    firebaseConfigured,
    usesFirebaseAuth,
    user,
    role,
    signIn,
    signOutUser,
    devSignIn,
    error,
    clearError,
    showDemoShortcuts,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !role) return;
    router.replace(role === "manager" ? "/manager" : "/driver");
  }, [ready, role, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setBusy(true);
    await signIn(email.trim(), password);
    setBusy(false);
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

  return (
    <AppShell showBrand>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sign in
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Vehicle journeys for Arnold Clark drivers and managers.{" "}
          {provider === "demo"
            ? "Demo mode — no Firebase required."
            : "Firebase mode — uses your project Auth and Firestore."}
        </p>
      </div>

      {showFirebaseMisconfigured ? (
        <Card className="border-amber-500/35 bg-amber-500/10 dark:bg-amber-500/10">
          <div className="flex gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden
            />
            <div className="text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Firebase keys missing</p>
              <p className="mt-1 opacity-90">
                Copy{" "}
                <code className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-xs">
                  env.template
                </code>{" "}
                to{" "}
                <code className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-xs">
                  .env.local
                </code>{" "}
                with your Web app config, or set{" "}
                <code className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-xs">
                  NEXT_PUBLIC_AUTH_PROVIDER=demo
                </code>{" "}
                for local UI without Firebase.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {usesFirebaseAuth && user && !role ? (
        <Card className="border-danger/40 bg-danger-bg">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 text-sm text-foreground">
              <p className="font-semibold">Account role missing</p>
              <p className="mt-1 text-muted">
                Add Firestore document{" "}
                <code className="break-all rounded-md bg-muted-bg px-1.5 py-0.5 font-mono text-xs text-foreground">
                  users/{user.uid}
                </code>{" "}
                with field{" "}
                <code className="font-mono text-xs">&quot;role&quot;</code>:{" "}
                <code className="font-mono text-xs">&quot;driver&quot;</code>{" "}
                or{" "}
                <code className="font-mono text-xs">&quot;manager&quot;</code>.
              </p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => signOutUser()}
                type="button"
              >
                Sign out
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {showDemoForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              Demo credentials
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
            <Button disabled={busy} type="submit" className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      ) : null}

      {showFirebaseForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              Firebase
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              Use an account from Firebase Authentication with a matching
              Firestore profile.
            </p>
          </CardHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-email">Email</Label>
              <Input
                autoComplete="email"
                id="fb-email"
                inputMode="email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="fb-password"
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                value={password}
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button disabled={busy} type="submit" className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      ) : null}

      {showDemoShortcuts ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Quick entry</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {provider === "firebase"
                ? "Development only — bypasses Firebase for UI work."
                : "Jump straight into a role."}
            </p>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="min-w-[9rem] flex-1"
              onClick={() => goDemo("driver")}
              type="button"
            >
              Continue as driver
            </Button>
            <Button
              variant="secondary"
              className="min-w-[9rem] flex-1"
              onClick={() => goDemo("manager")}
              type="button"
            >
              Continue as manager
            </Button>
          </div>
        </Card>
      ) : null}

      <p className="text-center text-sm text-muted">
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="/"
        >
          Back to home
        </Link>
      </p>
    </AppShell>
  );
}
