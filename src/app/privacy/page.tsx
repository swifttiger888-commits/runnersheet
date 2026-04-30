import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "RunnerSheet — privacy summary for in-house use.",
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
        Privacy
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
        <p>
          RunnerSheet is intended for in-house fleet use. Journey and account
          data are handled according to your organisation&apos;s Firebase and
          access policies.
        </p>
        <p>
          This app is independent and not affiliated with or endorsed by Arnold
          Clark.
        </p>
      </div>
    </div>
  );
}
