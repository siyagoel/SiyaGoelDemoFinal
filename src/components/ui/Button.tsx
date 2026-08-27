import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-fg text-on-fg hover:bg-fg-hover disabled:hover:bg-fg border border-transparent font-medium",
  secondary:
    "bg-panel text-fg border border-line hover:border-line-strong hover:bg-panel-hover",
  ghost: "bg-transparent text-muted border border-transparent hover:bg-panel-hover hover:text-fg",
  danger:
    "bg-[var(--danger-soft)] text-danger border border-[rgba(248,113,113,0.3)] hover:bg-[rgba(248,113,113,0.2)]",
  success:
    "bg-[var(--success-soft)] text-success border border-[rgba(52,211,153,0.3)] hover:bg-[rgba(52,211,153,0.2)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap transition-[background,border-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {icon ? <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {children}
    </button>
  );
}
