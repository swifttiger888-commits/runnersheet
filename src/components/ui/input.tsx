import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-foreground shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-elevated ${className}`}
      {...props}
    />
  );
}
