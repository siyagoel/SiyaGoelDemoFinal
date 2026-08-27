import { buildAuditEvent } from "@/lib/audit/service";
import type { AuditAction, AuditEvent } from "@/lib/audit/types";
import {
  STATUS_LABELS,
  TERMINAL_STATUSES,
  type KycApplication,
  type ReviewAction,
  type ReviewStatus,
} from "./types";

export interface ReviewCommand {
  action: ReviewAction;
  actor: string;
  actorName?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  occurredAt?: Date;
  eventId?: string;
}

export interface ReviewResult {
  application: KycApplication;
  event: AuditEvent;
}

export class ReviewError extends Error {}

/** Audit history of the application, used for policies that span actions. */
export interface ReviewContext {
  actor?: string;
  history?: AuditEvent[];
}

const RESULTING_STATUS: Record<ReviewAction, ReviewStatus> = {
  approve: "approved",
  reject: "rejected",
  escalate: "escalated",
};

/** Maps a review action onto the platform-wide audit action code. */
export const REVIEW_AUDIT_ACTIONS: Record<ReviewAction, AuditAction> = {
  approve: "KYC_APPROVED",
  reject: "KYC_REJECTED",
  escalate: "KYC_ESCALATED",
};

export function isTerminal(status: ReviewStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Compliance policy: a high-risk case must go through escalation before it can
 * be approved, and the approval itself must carry a reviewer note.
 */
export function requiresEscalationBeforeApproval(
  application: KycApplication,
): boolean {
  return application.riskLevel === "high" && application.status !== "escalated";
}

function normaliseActor(actor: string): string {
  return actor.trim().toLowerCase();
}

/** Email of the reviewer who escalated the case, from its audit history. */
export function escalatedBy(history: AuditEvent[]): string | null {
  return history.find((event) => event.action === "KYC_ESCALATED")?.actor ?? null;
}

/** Actions that the escalating reviewer is not allowed to take. */
const FINAL_DECISIONS: ReviewAction[] = ["approve", "reject"];

export const SEPARATION_OF_DUTIES_MESSAGE =
  "You escalated this case. A different reviewer must make the final decision.";

/**
 * Separation of duties: the reviewer who escalated a case may neither approve
 * nor reject it, so the final decision always involves a second person.
 */
export function escalatedByActor(actor: string, history: AuditEvent[]): boolean {
  const escalator = escalatedBy(history);
  return escalator !== null && normaliseActor(escalator) === normaliseActor(actor);
}

export function violatesSeparationOfDuties(
  action: ReviewAction,
  actor: string,
  history: AuditEvent[],
): boolean {
  return FINAL_DECISIONS.includes(action) && escalatedByActor(actor, history);
}

export function requiresReviewerNote(
  application: KycApplication,
  action: ReviewAction,
): boolean {
  if (action === "reject" || action === "escalate") return true;
  return application.riskLevel === "high";
}

export function canApply(
  application: KycApplication,
  action: ReviewAction,
  context: ReviewContext = {},
): boolean {
  if (isTerminal(application.status)) return false;
  if (action === "escalate") return application.status !== "escalated";

  const { actor, history } = context;
  if (actor && history && violatesSeparationOfDuties(action, actor, history)) return false;
  if (action === "approve" && requiresEscalationBeforeApproval(application)) return false;
  return true;
}

/**
 * Pure state transition: validates the command, returns the next application
 * plus the audit event that records it. Never mutates its input.
 */
export function applyReviewAction(
  application: KycApplication,
  command: ReviewCommand,
  history: AuditEvent[] = [],
): ReviewResult {
  const { action, actor } = command;
  const reason = command.reason?.trim() ? command.reason.trim() : null;

  if (!actor.trim()) {
    throw new ReviewError("An actor is required to record a review action.");
  }

  if (isTerminal(application.status)) {
    throw new ReviewError(
      `Application ${application.id} is already ${application.status} and cannot be changed.`,
    );
  }

  if (action === "escalate" && application.status === "escalated") {
    throw new ReviewError(`Application ${application.id} is already escalated.`);
  }

  if (violatesSeparationOfDuties(action, actor, history)) {
    throw new ReviewError(SEPARATION_OF_DUTIES_MESSAGE);
  }

  if (action === "reject" && !reason) {
    throw new ReviewError("A reason is required when rejecting an application.");
  }

  if (action === "escalate" && !reason) {
    throw new ReviewError("A reason is required when escalating an application.");
  }

  if (action === "approve" && requiresEscalationBeforeApproval(application)) {
    throw new ReviewError(
      `Application ${application.id} is high risk and must be escalated before it can be approved.`,
    );
  }

  if (action === "approve" && application.riskLevel === "high" && !reason) {
    throw new ReviewError(
      "A reviewer note is required when approving a high-risk application.",
    );
  }

  const occurredAt = command.occurredAt ?? new Date();
  const toStatus = RESULTING_STATUS[action];

  const next: KycApplication = {
    ...application,
    status: toStatus,
    decidedAt: isTerminal(toStatus) ? occurredAt.toISOString() : null,
    decisionReason: isTerminal(toStatus) ? reason : application.decisionReason,
  };

  const event = buildAuditEvent({
    id: command.eventId,
    action: REVIEW_AUDIT_ACTIONS[action],
    resourceType: "kyc_application",
    resourceId: application.id,
    resourceLabel: application.fullName,
    actor: actor.trim(),
    actorName: command.actorName ?? null,
    actorRole: command.actorRole ?? null,
    changedField: "Status",
    previousValue: STATUS_LABELS[application.status],
    newValue: STATUS_LABELS[toStatus],
    reason,
    occurredAt,
  });

  return { application: next, event };
}
