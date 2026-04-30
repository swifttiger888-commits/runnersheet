import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Car,
  KeyRound,
  LogIn,
  Mic,
  MapPin,
  Sparkles,
  TabletSmartphone,
} from "lucide-react";
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
          Driver jobs, manager control, and smarter search in one place
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-muted">
          For <strong className="font-semibold text-foreground">drivers</strong>
          , RunnerSheet records jobs and active routes. For{" "}
          <strong className="font-semibold text-foreground">managers</strong>, it
          surfaces alerts, branch views, AI-assisted search, and PDF reports -
          all in the browser on phones, tablets, and desktops.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Magic Search
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-muted">
            <Mic className="h-3.5 w-3.5 text-primary" aria-hidden />
            Voice search
          </span>
        </div>
        <p className="max-w-prose text-xs leading-relaxed text-muted">
          Built by Johnny (Arnold Clark, Leeds). Independent app; not
          affiliated with Arnold Clark. This app is not a replacement for your
          AC Runner Sheet folder.
        </p>
        <p>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            See how it works
          </Link>
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
            Built-in DVLA number plate checks and app-like screens that work
            cleanly on phone, tablet, and desktop.
          </p>
        </Card>
        <Card className="p-4">
          <KeyRound
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Smarter manager search</p>
          <p className="mt-1 text-sm text-muted">
            Type or speak plain-English queries like &quot;white Renault in Leeds&quot;
            and jump to matching jobs faster.
          </p>
        </Card>
        <Card className="p-4">
          <MapPin
            className="mb-2 h-6 w-6 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="font-semibold text-foreground">Secure and auditable</p>
          <p className="mt-1 text-sm text-muted">
            Save in secure database or print like the original sheet, with
            clear route history and cancellation labels.
          </p>
        </Card>
      </div>

      <section
        id="how-it-works"
        className="scroll-mt-6 space-y-4 rounded-2xl border border-border/80 bg-surface-elevated/40 p-4 shadow-card-quiet md:p-5"
        aria-labelledby="how-it-works-heading"
      >
        <div className="space-y-1">
          <h2
            id="how-it-works-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            See how Magic Search works
          </h2>
          <p className="max-w-prose text-sm text-muted">
            Managers type or speak a plain-English query; RunnerSheet turns it
            into filters and lists matching jobs. Sensitive labels stay on your
            side until you open a journey.
          </p>
        </div>
        <div className="mx-auto max-w-sm rounded-[1.25rem] border border-border bg-[#0d0d0f] p-3 shadow-card-quiet">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted">All journeys</p>
            <Sparkles
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden
            />
          </div>
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-2 shadow-inset-field">
            <span className="truncate text-xs text-muted">
              white renault in leeds
            </span>
            <Mic className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          </div>
          <p className="mb-2 text-[11px] leading-snug text-muted">
            <span className="font-medium text-foreground/90">Interpreted as:</span>{" "}
            White Renault · Leeds branch
          </p>
          <ul className="space-y-2" role="list">
            <li className="rounded-xl border border-border/60 bg-surface px-3 py-2">
              <p className="text-xs font-semibold text-foreground">
                AB12 CDE · Delivery
              </p>
              <p className="text-[11px] text-muted">Leeds · completed</p>
            </li>
            <li className="rounded-xl border border-border/60 bg-surface px-3 py-2">
              <p className="text-xs font-semibold text-foreground">
                XY21 ZZZ · Collection
              </p>
              <p className="text-[11px] text-muted">Leeds · active</p>
            </li>
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-muted">
            Illustrative preview — results come from your Firestore data after
            sign-in.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Choose the sign-in that matches your role. Your access is set in
            RunnerSheet (same login flow; we just show the right guidance).
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
            <span className="rounded-full border border-border px-2.5 py-1">
              Driver + Manager access
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">
              Instant branch filtering
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">
              PDF-ready records
            </span>
          </div>
        </CardHeader>
        <div className="flex flex-col gap-2 border-t border-border px-5 pb-5 pt-3 sm:flex-row">
          <Link
            href="/login?as=driver"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold tracking-tight text-primary-foreground shadow-control transition-[filter] duration-200 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Car className="h-4 w-4" aria-hidden />
            Driver sign in
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/login?as=manager"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold tracking-tight text-foreground transition-[background-color,filter,color] duration-200 hover:bg-muted-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Briefcase className="h-4 w-4" aria-hidden />
            Manager sign in
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="border-t border-border px-5 pb-5 pt-3">
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted transition-colors hover:bg-muted-bg/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/login"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Other sign-in
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}
