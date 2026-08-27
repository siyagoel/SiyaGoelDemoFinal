import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "warning" | "danger" | "success" | "accent";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-overlay-1 text-muted ring-line",
  info: "bg-[var(--info-soft)] text-info ring-[rgba(96,165,250,0.24)]",
  warning: "bg-[var(--warning-soft)] text-warning ring-[rgba(251,191,36,0.24)]",
  danger: "bg-[var(--danger-soft)] text-danger ring-[rgba(248,113,113,0.24)]",
  success: "bg-[var(--success-soft)] text-success ring-[rgba(52,211,153,0.24)]",
  accent: "bg-[var(--accent-soft)] text-accent ring-[rgba(59,130,246,0.24)]",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-faint",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
  accent: "bg-accent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} /> : null}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-line bg-elevated px-1.5 font-mono text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}
