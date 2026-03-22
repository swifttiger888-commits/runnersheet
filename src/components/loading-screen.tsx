import { Loader2 } from "lucide-react";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-9 w-9 animate-spin text-primary"
        strokeWidth={2}
        aria-hidden
      />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
