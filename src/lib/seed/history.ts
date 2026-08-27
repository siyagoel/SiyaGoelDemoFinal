import { createAuditEvent, type AuditEvent } from "@/lib/audit/types";
import { createSeedFlags } from "@/lib/flags/seed";
import type { FeatureFlag } from "@/lib/flags/types";
import { formatMoney } from "@/lib/format";
import { createSeedApplications, seedReferenceTime } from "@/lib/kyc/seed";
import { STATUS_LABELS, type KycApplication } from "@/lib/kyc/types";
import { createSeedRefunds } from "@/lib/refunds/seed";
import { REFUND_STATUS_LABELS, type RefundRequest } from "@/lib/refunds/types";

/**
 * A prototype opened for the first time should look like a platform that has
 * been in use, not an empty one: some cases already decided, some flags already
 * moved, and an audit log that explains both. This module scripts that history
 * deterministically so the queue, the flag states and the shared log agree.
 */

interface Operator {
  email: string;
  name: string;
  role: "reviewer" | "engineer" | "admin";
}

const OPERATORS: Record<string, Operator> = {
  sam: { email: "sam.rivera@fintech-demo.com", name: "Sam Rivera", role: "reviewer" },
  maya: { email: "maya.chen@fintech-demo.com", name: "Maya Chen", role: "reviewer" },
  jordan: { email: "jordan.patel@fintech-demo.com", name: "Jordan Patel", role: "admin" },
  alex: { email: "alex.thompson@fintech-demo.com", name: "Alex Thompson", role: "engineer" },
};

interface DecisionScript {
  operator: keyof typeof OPERATORS;
  outcome: "approved" | "rejected";
  hoursAgo: number;
  reason: string;
  /** Recorded before the decision, by a different operator. */
  escalation?: { operator: keyof typeof OPERATORS; hoursAgo: number; reason: string };
}

/** Applied to the open queue in order; index into the seeded applications. */
const DECISIONS: DecisionScript[] = [
  {
    operator: "sam",
    outcome: "approved",
    hoursAgo: 5,
    reason: "Passport and proof of address match the submitted profile.",
  },
  {
    operator: "jordan",
    outcome: "approved",
    hoursAgo: 22,
    reason: "Sanctions near-match cleared: different date of birth and nationality.",
    escalation: {
      operator: "maya",
      hoursAgo: 30,
      reason: "Sanctions list near-match on surname — needs a second pair of eyes.",
    },
  },
  {
    operator: "maya",
    outcome: "rejected",
    hoursAgo: 29,
    reason: "Identity document expired and no replacement supplied within 7 days.",
  },
  {
    operator: "jordan",
    outcome: "rejected",
    hoursAgo: 54,
    reason: "Device fingerprint reused across four rejected applications this month.",
    escalation: {
      operator: "sam",
      hoursAgo: 68,
      reason: "Velocity pattern across signups; escalating for fraud review.",
    },
  },
  {
    operator: "sam",
    outcome: "approved",
    hoursAgo: 76,
    reason: "Address mismatch explained by a recent move; utility bill accepted.",
  },
  {
    operator: "maya",
    outcome: "approved",
    hoursAgo: 121,
    reason: "Liveness check re-run successfully on a second submission.",
  },
];

interface FlagScript {
  /** `key:environment` of the seeded flag. */
  id: string;
  operator: keyof typeof OPERATORS;
  hoursAgo: number;
  change:
    | { kind: "enable" }
    | { kind: "disable"; reason: string }
    | { kind: "rollout"; from: number; to: number; reason?: string };
}

const FLAG_CHANGES: FlagScript[] = [
  {
    id: "instant-payouts:production",
    operator: "alex",
    hoursAgo: 6,
    change: { kind: "rollout", from: 10, to: 25 },
  },
  {
    id: "virtual-cards:production",
    operator: "jordan",
    hoursAgo: 20,
    change: { kind: "rollout", from: 40, to: 60 },
  },
  {
    id: "risk-model-v3:staging",
    operator: "alex",
    hoursAgo: 34,
    change: { kind: "disable", reason: "False-positive rate above threshold in staging." },
  },
  {
    id: "statement-redesign:production",
    operator: "jordan",
    hoursAgo: 52,
    change: {
      kind: "rollout",
      from: 75,
      to: 100,
      reason: "Staged rollout completed with no elevated error rate over 14 days.",
    },
  },
  {
    id: "merchant-api-v2:production",
    operator: "alex",
    hoursAgo: 96,
    change: { kind: "enable" },
  },
];

interface RefundScript {
  /** Refund id from the refund seed. */
  id: string;
  operator: keyof typeof OPERATORS;
  outcome: "approved" | "denied";
  hoursAgo: number;
  reason: string | null;
}

/** Only an admin appears on decisions at or above the high-value threshold. */
const REFUND_DECISIONS: RefundScript[] = [
  {
    id: "RFD-4113",
    operator: "sam",
    outcome: "approved",
    hoursAgo: 60,
    reason: null,
  },
  {
    id: "RFD-4112",
    operator: "jordan",
    outcome: "approved",
    hoursAgo: 50,
    reason: null,
  },
  {
    id: "RFD-4118",
    operator: "maya",
    outcome: "denied",
    hoursAgo: 44,
    reason: "Card was used before the loss report was filed; issuer confirmed the timeline.",
  },
  {
    id: "RFD-4116",
    operator: "sam",
    outcome: "approved",
    hoursAgo: 33,
    reason: null,
  },
  {
    id: "RFD-4111",
    operator: "maya",
    outcome: "denied",
    hoursAgo: 12,
    reason: "Only one settlement found for this order; the second attempt was never captured.",
  },
];

export interface SeededPlatform {
  applications: KycApplication[];
  flags: FeatureFlag[];
  refunds: RefundRequest[];
  /** Oldest first, matching the order the log would have appended them. */
  events: AuditEvent[];
}

function at(baseTime: number, hoursAgo: number): Date {
  return new Date(baseTime - hoursAgo * 3_600_000);
}

/** Builds the seeded stores together with the audit history that explains them. */
export function createSeededPlatform(baseTime = seedReferenceTime()): SeededPlatform {
  const applications = createSeedApplications(28, baseTime);
  const flags = createSeedFlags(baseTime);
  const refunds = createSeedRefunds(baseTime);
  const drafts: { occurredAt: Date; event: Omit<AuditEvent, "id" | "occurredAt"> }[] = [];

  // Oldest cases in the queue are the ones a real team would have worked first.
  const byAge = [...applications].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  DECISIONS.forEach((script, index) => {
    const application = byAge[index];
    if (!application) return;

    let previousStatus = STATUS_LABELS[application.status];
    if (script.escalation) {
      const escalator = OPERATORS[script.escalation.operator];
      drafts.push({
        occurredAt: at(baseTime, script.escalation.hoursAgo),
        event: {
          actor: escalator.email,
          actorName: escalator.name,
          actorRole: escalator.role,
          action: "KYC_ESCALATED",
          resourceType: "kyc_application",
          resourceId: application.id,
          resourceLabel: application.fullName,
          changedField: "Status",
          previousValue: previousStatus,
          newValue: STATUS_LABELS.escalated,
          reason: script.escalation.reason,
        },
      });
      previousStatus = STATUS_LABELS.escalated;
    }

    const operator = OPERATORS[script.operator];
    const decidedAt = at(baseTime, script.hoursAgo);
    drafts.push({
      occurredAt: decidedAt,
      event: {
        actor: operator.email,
        actorName: operator.name,
        actorRole: operator.role,
        action: script.outcome === "approved" ? "KYC_APPROVED" : "KYC_REJECTED",
        resourceType: "kyc_application",
        resourceId: application.id,
        resourceLabel: application.fullName,
        changedField: "Status",
        previousValue: previousStatus,
        newValue: STATUS_LABELS[script.outcome],
        reason: script.reason,
      },
    });

    const decided: KycApplication = {
      ...application,
      status: script.outcome,
      decidedAt: decidedAt.toISOString(),
      decisionReason: script.reason,
    };
    applications[applications.findIndex((candidate) => candidate.id === application.id)] = decided;
  });

  FLAG_CHANGES.forEach((script) => {
    const index = flags.findIndex((candidate) => candidate.id === script.id);
    const flag = flags[index];
    if (!flag) return;

    const operator = OPERATORS[script.operator];
    const occurredAt = at(baseTime, script.hoursAgo);
    const base = {
      actor: operator.email,
      actorName: operator.name,
      actorRole: operator.role,
      resourceType: "feature_flag" as const,
      resourceId: flag.id,
      resourceLabel: `${flag.name} (${flag.environment})`,
    };

    // The event records the move onto the state the store ends up in, so the log
    // always explains what the reader sees. Rollouts carry their own prior
    // percentage: the seeded flag already holds the post-change value, so reading
    // it back would produce a no-op event.
    let next: FeatureFlag;
    if (script.change.kind === "rollout") {
      drafts.push({
        occurredAt,
        event: {
          ...base,
          action: "ROLLOUT_CHANGED",
          changedField: "Rollout",
          previousValue: `${script.change.from}%`,
          newValue: `${script.change.to}%`,
          reason: script.change.reason ?? null,
        },
      });
      next = { ...flag, rolloutPercentage: script.change.to };
    } else {
      const enabled = script.change.kind === "enable";
      drafts.push({
        occurredAt,
        event: {
          ...base,
          action: enabled ? "FLAG_ENABLED" : "FLAG_DISABLED",
          changedField: "Enabled",
          previousValue: enabled ? "Off" : "On",
          newValue: enabled ? "On" : "Off",
          reason: script.change.kind === "disable" ? script.change.reason : null,
        },
      });
      next = { ...flag, enabled };
    }

    flags[index] = { ...next, updatedAt: occurredAt.toISOString() };
  });

  REFUND_DECISIONS.forEach((script) => {
    const index = refunds.findIndex((candidate) => candidate.id === script.id);
    const refund = refunds[index];
    if (!refund) return;

    const operator = OPERATORS[script.operator];
    const decidedAt = at(baseTime, script.hoursAgo);
    drafts.push({
      occurredAt: decidedAt,
      event: {
        actor: operator.email,
        actorName: operator.name,
        actorRole: operator.role,
        action: script.outcome === "approved" ? "REFUND_APPROVED" : "REFUND_DENIED",
        resourceType: "refund_request",
        resourceId: refund.id,
        resourceLabel: `${refund.customerName} · ${formatMoney(refund.requestedAmountCents)}`,
        changedField: "Status",
        previousValue: REFUND_STATUS_LABELS.pending,
        newValue: REFUND_STATUS_LABELS[script.outcome],
        reason: script.reason,
      },
    });

    refunds[index] = {
      ...refund,
      status: script.outcome,
      reviewer: operator.name,
      decidedAt: decidedAt.toISOString(),
      decisionReason: script.reason,
    };
  });

  const events = drafts
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((draft, index) =>
      createAuditEvent({
        ...draft.event,
        id: `EVT-${(index + 1).toString().padStart(5, "0")}`,
        occurredAt: draft.occurredAt,
      }),
    );

  return { applications, flags, refunds, events };
}
