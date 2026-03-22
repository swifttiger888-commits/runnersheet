import type { ReactNode } from "react";
import { CarFront } from "lucide-react";

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
      {showBrand ? (
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <CarFront className="h-5 w-5" aria-hidden strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-foreground">
              RunnerSheet
            </p>
            <p className="truncate text-xs font-medium text-muted">
              AC Vehicle Tracker
            </p>
          </div>
        </div>
      ) : null}

      {(title || actions) && (
        <header className="mb-5 flex shrink-0 items-center justify-between gap-3">
          {title ? (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
