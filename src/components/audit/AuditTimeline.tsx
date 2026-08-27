import type { AuditEvent } from "@/lib/audit/types";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/types";
import { isRole, ROLE_LABELS } from "@/lib/auth/rbac";
import { formatDateTime } from "@/lib/format";
import type { BadgeTone } from "@/components/ui/Badge";

const ACTION_TONES: Record<AuditAction, BadgeTone> = {
  KYC_APPROVED: "success",
  KYC_REJECTED: "danger",
  KYC_ESCALATED: "warning",
  FLAG_ENABLED: "success",
  FLAG_DISABLED: "neutral",
  ROLLOUT_CHANGED: "info",
  REFUND_APPROVED: "success",
  REFUND_DENIED: "danger",
};

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-faint",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
  accent: "bg-accent",
};

export function formatActor(event: AuditEvent): string {
  const identity = event.actorName ? `${event.actorName} <${event.actor}>` : event.actor;
  if (!event.actorRole) return identity;
  const role = isRole(event.actorRole) ? ROLE_LABELS[event.actorRole] : event.actorRole;
  return `${identity} (${role})`;
}

export function formatChange(event: AuditEvent): string | null {
  if (event.previousValue === null && event.newValue === null) return null;
  return `${event.changedField ?? "Value"}: ${event.previousValue ?? "—"} → ${
    event.newValue ?? "—"
  }`;
}

/**
 * Renders the shared audit event shape, so every tool gets an identical
 * history panel backed by the same log.
 */
export function AuditTimeline({
  events,
  showResource = false,
}: {
  events: AuditEvent[];
  showResource?: boolean;
}) {
  if (events.length === 0) {
    return <p className="py-4 text-center text-xs text-faint">No audit events recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-line">
      {events.map((event) => {
        const change = formatChange(event);
        const tone = ACTION_TONES[event.action];
        return (
          <li key={event.id} className="relative pl-5">
            <span
              className={`absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-4 ring-panel ${DOT[tone]}`}
            />
            <p className="text-[13px] font-medium text-fg">
              {AUDIT_ACTION_LABELS[event.action]}
              {showResource ? (
                <span className="font-normal text-muted"> · {event.resourceLabel}</span>
              ) : null}
            </p>
            {change ? <p className="mt-0.5 font-mono text-xs text-muted">{change}</p> : null}
            <p className="mt-0.5 text-2xs text-faint">
              {`${formatActor(event)} · ${formatDateTime(event.occurredAt)}`}
            </p>
            {event.reason ? (
              <p className="mt-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs text-muted">
                {event.reason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
