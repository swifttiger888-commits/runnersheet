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
    "inline-flex min-h-11 min-w-[2.75rem] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-tight transition-[background-color,filter,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-control hover:brightness-110 active:brightness-95"
      : variant === "secondary"
        ? "border border-border bg-surface text-foreground hover:bg-muted-bg/50"
        : "text-muted hover:bg-muted-bg/50 hover:text-foreground";
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
