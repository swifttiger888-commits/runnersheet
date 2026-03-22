"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BarChart3, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { ready, role, user, signOutUser } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (role !== "manager") router.replace("/login");
  }, [ready, role, router]);

  if (!ready || role !== "manager") {
    return (
      <AppShell showBrand>
        <LoadingScreen label="Checking session…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      showBrand
      title="Manager"
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
            Demo session — connect Firebase for live dashboards.
          </>
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <LayoutDashboard
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Overview</p>
          <p className="mt-1 text-sm text-muted">
            Active journeys, alerts, and branch filters — wire to Firestore
            next.
          </p>
        </Card>
        <Card className="p-4">
          <BarChart3
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Reports</p>
          <p className="mt-1 text-sm text-muted">
            Daily PDF exports and sharing from the browser or API.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <p className="mt-1 text-sm text-muted">
            All journeys, drivers, alerts, speed camera lookup, and pending
            reviews will live here.
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
