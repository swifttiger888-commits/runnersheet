import type { ReactNode } from "react";
import Image from "next/image";
import { PageFade } from "@/components/page-fade";

type AppShellProps = {
  title?: string;
  /** Show RunnerSheet brand row above optional title */
  showBrand?: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  title,
  showBrand = true,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:max-w-2xl xl:max-w-4xl">
      {(showBrand || title || actions) && (
        <header className="mb-6 space-y-4 border-b border-border/60 pb-5">
          {showBrand ? (
            <div className="flex items-center gap-2.5">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-[#0d0d0f] shadow-inset-highlight">
                {/* Vector mark: crisp on HiDPI; public asset */}
                <Image
                  src="/icons/runnersheet-mark.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <Image
                  src="/icons/runnersheet-wordmark.svg"
                  alt="RUNNERSHEET.WIN"
                  width={245}
                  height={40}
                  className="h-6 w-auto md:h-7"
                  unoptimized
                />
                <p className="text-xs leading-snug text-muted">
                  A free tool · Developed for drivers by drivers
                </p>
              </div>
            </div>
          ) : null}
          {(title || actions) && (
            <div className="flex shrink-0 items-center justify-between gap-3">
              {title ? (
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
              ) : (
                <span />
              )}
              {actions ? (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              ) : null}
            </div>
          )}
        </header>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        <PageFade className="flex min-h-0 flex-1 flex-col gap-6">
          {children}
        </PageFade>
      </main>
    </div>
  );
}
