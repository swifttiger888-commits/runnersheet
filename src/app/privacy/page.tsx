import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyCookieActions } from "@/components/privacy-cookie-actions";

export const metadata: Metadata = {
  title: "Privacy & cookies",
  description:
    "How RunnerSheet uses analytics cookies and your choices.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] md:max-w-xl">
      <p className="mb-6">
        <Link
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          href="/"
        >
          ← Back
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Privacy & cookies
      </h1>
      <p className="mt-2 text-sm text-muted">
        RunnerSheet is a small independent tool for drivers and managers.
      </p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-foreground">
        <h2 className="text-base font-semibold text-foreground">
          Analytics (optional)
        </h2>
        <p className="text-muted">
          If you choose &quot;Accept analytics&quot;, we load Google Analytics
          (GA4) to understand aggregate traffic and how features are used (for
          example journey actions). We don&apos;t use it for ads or selling
          data.
        </p>
        <p className="text-muted">
          If you choose &quot;Reject&quot;, GA is not loaded and those
          measurement cookies are not set.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-card-quiet">
        <h2 className="text-base font-semibold text-foreground">
          Change your choice
        </h2>
        <p className="mt-2 text-sm text-muted">
          You can clear your choice and decide again — the cookie banner will
          come back after reload.
        </p>
        <div className="mt-4">
          <PrivacyCookieActions />
        </div>
      </section>
    </div>
  );
}
