"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, Route, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export default function DriverDashboardPage() {
  const router = useRouter();
  const { ready, role, user, signOutUser } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (role !== "driver") router.replace("/login");
  }, [ready, role, router]);

  if (!ready || role !== "driver") {
    return (
      <AppShell showBrand>
        <LoadingScreen label="Checking session…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      showBrand
      title="Driver"
      actions={
        <Button
          variant="ghost"
          className="min-h-10 gap-1.5 px-3 text-xs font-semibold"
          onClick={() => void signOutUser()}
          type="button"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        {user?.email ? (
          <>
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </>
        ) : (
          <>
            <Sparkles className="mr-1 inline h-4 w-4 text-primary" aria-hidden />
            Demo session — connect Firebase for synced journeys.
          </>
        )}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" aria-hidden />
            Your journeys
          </CardTitle>
          <p className="mt-1 text-sm text-muted">
            Next: load active and completed runs from Firestore, start/end
            journey with mileage and destination.
          </p>
        </CardHeader>
      </Card>

      <p className="text-center text-sm text-muted">
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="/"
        >
          Home
        </Link>
      </p>
    </AppShell>
  );
}
