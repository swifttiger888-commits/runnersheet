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
import { Card, CardHeader } from "@/components/ui/card";

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
          , RunnerSheet records jobs and active routes. It is your digital
          runner sheet for day-to-day branch work. For{" "}
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
          Independent app; not affiliated with Arnold Clark. Currently on trial
          — this app is not a replacement for your AC Runner Sheet folder until
          approved by your branch manager.
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
            Illustrative preview only — not interactive. Real journeys appear
            after sign-in.
          </p>
        </div>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="get-started-heading"
      >
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-primary sm:text-left">
          Sign in (live)
        </p>
        <Card className="border-primary/30 bg-primary/[0.07] p-0! shadow-[0_14px_44px_-14px_rgba(99,91,255,0.45)] ring-1 ring-primary/25">
          <CardHeader className="mb-0! border-b border-border/60 bg-surface/80 px-5 pb-4 pt-5">
            <h2
              id="get-started-heading"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Sign in to RunnerSheet
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Sign in with an account you are happy to use. Your role (driver or
              manager) comes from your RunnerSheet profile after you authenticate.
              RunnerSheet is independent and is not affiliated with Arnold Clark
              or your employer’s official systems — you do not need a “work”
              account. If you use a work email or device, that is your choice, but
              we do not recommend it.
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted">
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1">
                Driver + Manager access
              </span>
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1">
                Branch filtering
              </span>
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1">
                PDF-ready records
              </span>
            </div>
          </CardHeader>
          <div className="space-y-3 px-5 pb-5 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Choose how you sign in
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
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
            <div className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 shadow-inset-field">
              <Link
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/login"
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Other sign-in{" "}
                  <span className="font-normal text-muted">
                    (same login, general entry)
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
