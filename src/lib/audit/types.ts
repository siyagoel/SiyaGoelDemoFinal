/** Every tool in the platform writes events for one of these resources. */
export type AuditResourceType = "kyc_application" | "feature_flag" | "refund_request";

/** Canonical action codes recorded across all internal tools. */
export type AuditAction =
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "KYC_ESCALATED"
  | "FLAG_ENABLED"
  | "FLAG_DISABLED"
  | "ROLLOUT_CHANGED"
  | "REFUND_APPROVED"
  | "REFUND_DENIED";

export const AUDIT_ACTIONS: AuditAction[] = [
  "KYC_APPROVED",
  "KYC_REJECTED",
  "KYC_ESCALATED",
  "FLAG_ENABLED",
  "FLAG_DISABLED",
  "ROLLOUT_CHANGED",
  "REFUND_APPROVED",
  "REFUND_DENIED",
];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  KYC_APPROVED: "Approved",
  KYC_REJECTED: "Rejected",
  KYC_ESCALATED: "Escalated",
  FLAG_ENABLED: "Flag enabled",
  FLAG_DISABLED: "Flag disabled",
  ROLLOUT_CHANGED: "Rollout changed",
  REFUND_APPROVED: "Refund approved",
  REFUND_DENIED: "Refund denied",
};

/** Actions an operator is expected to review: everything except routine approvals. */
export const SENSITIVE_AUDIT_ACTIONS: AuditAction[] = [
  "KYC_REJECTED",
  "KYC_ESCALATED",
  "FLAG_ENABLED",
  "FLAG_DISABLED",
  "ROLLOUT_CHANGED",
  "REFUND_APPROVED",
  "REFUND_DENIED",
];

/** Time windows offered by the audit log filters. */
export const AUDIT_WINDOWS: { value: string; label: string; hours: number }[] = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "72h", label: "Last 72 hours", hours: 72 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
];

export function isSensitiveAuditAction(action: AuditAction): boolean {
  return SENSITIVE_AUDIT_ACTIONS.includes(action);
}

export const AUDIT_RESOURCE_TYPES: AuditResourceType[] = [
  "kyc_application",
  "feature_flag",
  "refund_request",
];

export const AUDIT_RESOURCE_LABELS: Record<AuditResourceType, string> = {
  kyc_application: "KYC Review Queue",
  feature_flag: "Feature Flags",
  refund_request: "Refund Operations",
};

export const AUDIT_RESOURCE_ACTIONS: Record<AuditResourceType, AuditAction[]> = {
  kyc_application: ["KYC_APPROVED", "KYC_REJECTED", "KYC_ESCALATED"],
  feature_flag: ["FLAG_ENABLED", "FLAG_DISABLED", "ROLLOUT_CHANGED"],
  refund_request: ["REFUND_APPROVED", "REFUND_DENIED"],
};

/**
 * Immutable record of a state change. Every tool writes this same shape, so
 * the platform audit log stays queryable across tools.
 */
export interface AuditEvent {
  id: string;
  occurredAt: string;
  /** Email of the person who performed the action. */
  actor: string;
  actorName: string | null;
  actorRole: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  /** Human-readable name of the resource, e.g. the applicant or flag name. */
  resourceLabel: string;
  /** What changed, e.g. "Status" or "Rollout"; null when nothing is compared. */
  changedField: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
}

export interface AuditEventInput {
  id: string;
  actor: string;
  actorName?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceLabel: string;
  changedField?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  occurredAt: Date;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return Object.freeze({
    id: input.id,
    occurredAt: input.occurredAt.toISOString(),
    actor: input.actor,
    actorName: input.actorName ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    resourceLabel: input.resourceLabel,
    changedField: input.changedField ?? null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason?.trim() ? input.reason.trim() : null,
  });
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as string[]).includes(value);
}

export function isAuditResourceType(value: unknown): value is AuditResourceType {
  return (
    typeof value === "string" && (AUDIT_RESOURCE_TYPES as string[]).includes(value)
  );
}
