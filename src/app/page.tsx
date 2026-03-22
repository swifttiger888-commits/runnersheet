import Link from "next/link";
import { ArrowRight, Gauge, MapPin, TabletSmartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <AppShell showBrand>
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Fleet operations
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Journeys, visibility, and reports in one place
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-muted">
          RunnerSheet helps Arnold Clark teams track runs, see active journeys,
          and produce branch reports — in the browser on phones, tablets, and
          desktops.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <TabletSmartphone
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Mobile-first</p>
          <p className="mt-1 text-sm text-muted">
            Touch-friendly layouts; add to Home Screen when you need an
            app-like shell.
          </p>
        </Card>
        <Card className="p-4">
          <Gauge
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Live-ready</p>
          <p className="mt-1 text-sm text-muted">
            Built for Firebase Auth and Firestore when you connect your
            project.
          </p>
        </Card>
        <Card className="p-4">
          <MapPin
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Branch-aware</p>
          <p className="mt-1 text-sm text-muted">
            Room for branch filters, PDFs, and manager dashboards next.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Sign in with demo mode, or connect Firebase for production data.
          </p>
        </CardHeader>
        <Link
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
          href="/login"
        >
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Card>
    </AppShell>
  );
}
