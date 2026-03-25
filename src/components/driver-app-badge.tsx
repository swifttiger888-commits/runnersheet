import { Smartphone } from "lucide-react";

type DriverAppBadgeProps = {
  /** `true` = PWA / home screen; `false` or missing = mobile browser (not tracked as installed). */
  isInstalled: boolean;
  className?: string;
};

/**
 * Small app-install indicator: green when `isInstalled` is set on the user doc;
 * gray/red when they still appear to use the in-browser experience.
 */
export function DriverAppBadge({ isInstalled, className = "" }: DriverAppBadgeProps) {
  const installed = isInstalled === true;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border p-1 ${
        installed
          ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-400"
          : "border-red-500/35 bg-muted-bg/90 text-muted"
      } ${className}`.trim()}
      title={
        installed
          ? "App installed (home screen shortcut)"
          : "Using the mobile browser — not installed as an app"
      }
      aria-label={
        installed
          ? "App installed on home screen"
          : "Using mobile browser, app not installed"
      }
    >
      <Smartphone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}
