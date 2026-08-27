"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconLock } from "@/components/ui/icons";

export type DialogTone = "neutral" | "warning" | "danger";

const TONE_ACCENT: Record<DialogTone, string> = {
  neutral: "border-line-strong",
  warning: "border-[rgba(251,191,36,0.35)]",
  danger: "border-[rgba(248,113,113,0.35)]",
};

const TONE_BANNER: Record<DialogTone, string> = {
  neutral: "",
  warning: "bg-[var(--warning-soft)] text-warning",
  danger: "bg-[var(--danger-soft)] text-danger",
};

/**
 * Confirmation dialog for sensitive actions: modal semantics, Escape to
 * cancel, focus moved into the panel on open and restored to the trigger on
 * close.
 */
export function ConfirmDialog({
  title,
  resource,
  tone = "neutral",
  sensitivity,
  onCancel,
  children,
  footer,
}: {
  title: string;
  /** The thing being changed, e.g. the applicant or the flag and environment. */
  resource: ReactNode;
  tone?: DialogTone;
  /** One line explaining why the action needs care; shown as a banner. */
  sensitivity?: string;
  onCancel: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      "textarea, input:not([type=hidden]), select, button",
    );
    (first ?? panel)?.focus();

    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input:not([type=hidden]), select, [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={onCancel}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={`w-full max-w-md rounded-xl border bg-panel shadow-overlay outline-none animate-pop ${TONE_ACCENT[tone]}`}
      >
        <div className="border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-fg">
            {title}
          </h2>
          <div className="mt-0.5 text-xs text-muted">{resource}</div>
        </div>
        {sensitivity ? (
          <p
            className={`flex items-start gap-2 border-b border-line px-4 py-2 text-xs ${TONE_BANNER[tone]}`}
          >
            <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{sensitivity}</span>
          </p>
        ) : null}
        <div className="space-y-3 px-4 py-3.5">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Current → proposed comparison shown inside a confirmation dialog. */
export function ChangePreview({
  rows,
}: {
  rows: { label: string; current: ReactNode; proposed: ReactNode }[];
}) {
  return (
    <dl className="overflow-hidden rounded-lg border border-line">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[7rem_1fr_auto_1fr] items-center gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0"
        >
          <dt className="text-2xs uppercase tracking-wider text-faint">{row.label}</dt>
          <dd className="text-muted line-through decoration-[var(--border-strong)]">
            {row.current}
          </dd>
          <span aria-hidden className="text-faint">
            →
          </span>
          <dd className="font-medium text-fg">{row.proposed}</dd>
        </div>
      ))}
    </dl>
  );
}
