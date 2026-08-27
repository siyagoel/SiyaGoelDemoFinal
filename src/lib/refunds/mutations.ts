import { buildAuditEvent } from "@/lib/audit/service";
import type { AuditAction, AuditEvent } from "@/lib/audit/types";
import { formatMoney } from "@/lib/format";
import {
  isTerminalRefund,
  REFUND_STATUS_LABELS,
  type RefundDecision,
  type RefundRequest,
  type RefundStatus,
} from "./types";

export interface RefundCommand {
  decision: RefundDecision;
  actor: string;
  actorName?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  occurredAt?: Date;
  eventId?: string;
}

export interface RefundResult {
  refund: RefundRequest;
  event: AuditEvent;
}

export class RefundError extends Error {}

const RESULTING_STATUS: Record<RefundDecision, RefundStatus> = {
  approve: "approved",
  deny: "denied",
};

/** Maps a refund decision onto the platform-wide audit action code. */
export const REFUND_AUDIT_ACTIONS: Record<RefundDecision, AuditAction> = {
  approve: "REFUND_APPROVED",
  deny: "REFUND_DENIED",
};

/** Denying a refund is a customer-facing outcome, so it must be justified. */
export function requiresReasonForDecision(decision: RefundDecision): boolean {
  return decision === "deny";
}

/**
 * Pure state transition mirroring the KYC and flag layers: validate the
 * command, return the next refund plus the audit event recording it. Never
 * mutates its input, so a rejected decision leaves no trace.
 */
export function applyRefundDecision(
  refund: RefundRequest,
  command: RefundCommand,
): RefundResult {
  const { decision, actor } = command;
  const reason = command.reason?.trim() ? command.reason.trim() : null;

  if (!actor.trim()) {
    throw new RefundError("An actor is required to decide a refund request.");
  }

  if (isTerminalRefund(refund.status)) {
    throw new RefundError(
      `Refund ${refund.id} is already ${refund.status} and cannot be changed.`,
    );
  }

  if (requiresReasonForDecision(decision) && !reason) {
    throw new RefundError("A reason is required when denying a refund.");
  }

  const occurredAt = command.occurredAt ?? new Date();
  const status = RESULTING_STATUS[decision];

  const next: RefundRequest = {
    ...refund,
    status,
    reviewer: command.actorName ?? actor.trim(),
    decidedAt: occurredAt.toISOString(),
    decisionReason: reason,
  };

  const event = buildAuditEvent({
    id: command.eventId,
    action: REFUND_AUDIT_ACTIONS[decision],
    resourceType: "refund_request",
    resourceId: refund.id,
    // The amount travels with the event so the shared log explains the money
    // moved without the audit reader loading the refund record.
    resourceLabel: `${refund.customerName} · ${formatMoney(refund.requestedAmountCents)}`,
    actor: actor.trim(),
    actorName: command.actorName ?? null,
    actorRole: command.actorRole ?? null,
    changedField: "Status",
    previousValue: REFUND_STATUS_LABELS[refund.status],
    newValue: REFUND_STATUS_LABELS[status],
    reason,
    occurredAt,
  });

  return { refund: next, event };
}
