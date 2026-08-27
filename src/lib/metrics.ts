import { isSensitiveAuditAction, type AuditEvent } from "@/lib/audit/types";
import type { FeatureFlag } from "@/lib/flags/types";
import type { KycApplication, ReviewStatus, RiskLevel } from "@/lib/kyc/types";
import { isHighValueRefund } from "@/lib/refunds/policy";
import type { RefundRequest } from "@/lib/refunds/types";

/**
 * Read-only rollups for the operations dashboard. Pure functions over records
 * the stores already hold, so nothing here can affect state and every number
 * on the dashboard is testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const OPEN_STATUSES: ReviewStatus[] = ["pending", "escalated"];

export function isOpen(application: KycApplication): boolean {
  return OPEN_STATUSES.includes(application.status);
}

export function statusBreakdown(
  applications: KycApplication[],
): Record<ReviewStatus, number> {
  const counts: Record<ReviewStatus, number> = {
    pending: 0,
    escalated: 0,
    approved: 0,
    rejected: 0,
  };
  for (const application of applications) counts[application.status] += 1;
  return counts;
}

export function openRiskMix(applications: KycApplication[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
  for (const application of applications) {
    if (isOpen(application)) counts[application.riskLevel] += 1;
  }
  return counts;
}

/** Whole days an open case has been waiting; decided cases return null. */
export function ageInDays(application: KycApplication, now: Date): number | null {
  if (!isOpen(application)) return null;
  const submitted = new Date(application.submittedAt).getTime();
  return Math.max(0, Math.floor((now.getTime() - submitted) / DAY_MS));
}

export interface AgeBucket {
  label: string;
  value: number;
  /** Cases in this bucket are past the review SLA. */
  breach: boolean;
}

/** Aging profile of the open queue against a review SLA, in days. */
export function agingBuckets(
  applications: KycApplication[],
  now: Date,
  slaDays = 3,
): AgeBucket[] {
  const buckets: AgeBucket[] = [
    { label: "< 1 day", value: 0, breach: false },
    { label: "1–2 days", value: 0, breach: false },
    { label: `${slaDays}+ days`, value: 0, breach: true },
  ];

  for (const application of applications) {
    const age = ageInDays(application, now);
    if (age === null) continue;
    if (age >= slaDays) buckets[2].value += 1;
    else if (age >= 1) buckets[1].value += 1;
    else buckets[0].value += 1;
  }
  return buckets;
}

export function slaBreaches(
  applications: KycApplication[],
  now: Date,
  slaDays = 3,
): KycApplication[] {
  return applications
    .filter((application) => (ageInDays(application, now) ?? -1) >= slaDays)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export interface DayPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  label: string;
  value: number;
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Counts timestamps into a dense series of the last `days` days, oldest first. */
export function dailySeries(timestamps: string[], now: Date, days = 14): DayPoint[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const counts = new Map<string, number>();
  for (const timestamp of timestamps) {
    const key = timestamp.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const time = end - (days - 1 - index) * DAY_MS;
    const date = isoDate(time);
    return {
      date,
      label: new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      value: counts.get(date) ?? 0,
    };
  });
}

export function submissionSeries(
  applications: KycApplication[],
  now: Date,
  days = 14,
): DayPoint[] {
  return dailySeries(
    applications.map((application) => application.submittedAt),
    now,
    days,
  );
}

export function decisionSeries(events: AuditEvent[], now: Date, days = 14): DayPoint[] {
  return dailySeries(
    events
      .filter((event) => event.action === "KYC_APPROVED" || event.action === "KYC_REJECTED")
      .map((event) => event.occurredAt),
    now,
    days,
  );
}

/** Share of all cases that have reached a terminal state, 0–100. */
export function clearanceRate(applications: KycApplication[]): number {
  if (applications.length === 0) return 0;
  const decided = applications.filter((application) => !isOpen(application)).length;
  return Math.round((decided / applications.length) * 100);
}

/** Share of decisions that were approvals, 0–100; null when nothing is decided. */
export function approvalRate(applications: KycApplication[]): number | null {
  const approved = applications.filter((a) => a.status === "approved").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  if (approved + rejected === 0) return null;
  return Math.round((approved / (approved + rejected)) * 100);
}

export interface FlagSummary {
  total: number;
  enabled: number;
  production: number;
  productionEnabled: number;
  fullyRolledOut: number;
  partialRollouts: number;
  averageProductionRollout: number;
}

export function flagSummary(flags: FeatureFlag[]): FlagSummary {
  const production = flags.filter((flag) => flag.environment === "production");
  const productionEnabled = production.filter((flag) => flag.enabled);
  const totalRollout = productionEnabled.reduce((sum, flag) => sum + flag.rolloutPercentage, 0);

  return {
    total: flags.length,
    enabled: flags.filter((flag) => flag.enabled).length,
    production: production.length,
    productionEnabled: productionEnabled.length,
    fullyRolledOut: productionEnabled.filter((flag) => flag.rolloutPercentage === 100).length,
    partialRollouts: productionEnabled.filter(
      (flag) => flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100,
    ).length,
    averageProductionRollout:
      productionEnabled.length === 0
        ? 0
        : Math.round(totalRollout / productionEnabled.length),
  };
}

export interface RefundSummary {
  pending: number;
  /** Requested value of everything still awaiting a decision, in cents. */
  pendingValueCents: number;
  highValuePending: number;
  highValuePendingCents: number;
  approved: number;
  denied: number;
  /** Share of decided refunds that were approved, 0–100; null when none decided. */
  approvalRate: number | null;
}

export function refundSummary(refunds: RefundRequest[]): RefundSummary {
  const pending = refunds.filter((refund) => refund.status === "pending");
  const highValuePending = pending.filter((refund) =>
    isHighValueRefund(refund.requestedAmountCents),
  );
  const approved = refunds.filter((refund) => refund.status === "approved").length;
  const denied = refunds.filter((refund) => refund.status === "denied").length;
  const sum = (records: RefundRequest[]) =>
    records.reduce((total, refund) => total + refund.requestedAmountCents, 0);

  return {
    pending: pending.length,
    pendingValueCents: sum(pending),
    highValuePending: highValuePending.length,
    highValuePendingCents: sum(highValuePending),
    approved,
    denied,
    approvalRate:
      approved + denied === 0 ? null : Math.round((approved / (approved + denied)) * 100),
  };
}

/**
 * Actions an operator would want to notice: rejections, escalations, refund
 * decisions and any production-affecting flag change within the window.
 */
export function recentSensitiveActions(
  events: AuditEvent[],
  now: Date,
  hours = 72,
): AuditEvent[] {
  const cutoff = now.getTime() - hours * 3_600_000;
  return events.filter(
    (event) => isSensitiveAuditAction(event.action) && Date.parse(event.occurredAt) >= cutoff,
  );
}

export interface ActorActivity {
  actor: string;
  name: string;
  count: number;
}

/** Most active actors in the shared audit log, highest first. */
export function topActors(events: AuditEvent[], limit = 4): ActorActivity[] {
  const totals = new Map<string, ActorActivity>();
  for (const event of events) {
    const key = event.actor.trim().toLowerCase();
    const existing = totals.get(key);
    if (existing) existing.count += 1;
    else totals.set(key, { actor: event.actor, name: event.actorName ?? event.actor, count: 1 });
  }
  return Array.from(totals.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
