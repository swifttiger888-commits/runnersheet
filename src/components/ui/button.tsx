import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-11 min-w-[2.75rem] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-tight transition-[background-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:scale-[0.99]"
      : variant === "secondary"
        ? "border border-border bg-surface text-foreground shadow-sm hover:bg-muted-bg/50 dark:bg-surface-elevated dark:hover:bg-muted-bg/30"
        : "text-muted hover:bg-muted-bg/60 hover:text-foreground dark:hover:bg-muted-bg/20";
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
