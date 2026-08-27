import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@/lib/audit/types";
import type { FeatureFlag } from "@/lib/flags/types";
import type { KycApplication, ReviewStatus, RiskLevel } from "@/lib/kyc/types";
import {
  ageInDays,
  agingBuckets,
  approvalRate,
  clearanceRate,
  dailySeries,
  decisionSeries,
  flagSummary,
  isOpen,
  openRiskMix,
  recentSensitiveActions,
  slaBreaches,
  statusBreakdown,
  submissionSeries,
  topActors,
} from "./metrics";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function application(
  id: string,
  status: ReviewStatus,
  submittedDaysAgo: number,
  riskLevel: RiskLevel = "low",
): KycApplication {
  return {
    id,
    fullName: `Applicant ${id}`,
    email: `${id.toLowerCase()}@example.com`,
    country: "Ireland",
    dateOfBirth: "1990-01-01",
    submittedAt: daysAgo(submittedDaysAgo),
    riskLevel,
    riskScore: 50,
    status,
    flags: [],
    documents: [],
    decidedAt: null,
    decisionReason: null,
  };
}

function flag(
  id: string,
  environment: FeatureFlag["environment"],
  enabled: boolean,
  rolloutPercentage: number,
): FeatureFlag {
  return {
    id,
    key: id,
    name: id,
    description: "",
    environment,
    enabled,
    rolloutPercentage,
    owner: "Platform",
    updatedAt: daysAgo(1),
  };
}

function event(
  action: AuditEvent["action"],
  actor: string,
  name: string,
  occurredDaysAgo: number,
): AuditEvent {
  return {
    id: `${action}-${actor}-${occurredDaysAgo}`,
    occurredAt: daysAgo(occurredDaysAgo),
    actor,
    actorName: name,
    actorRole: "reviewer",
    action,
    resourceType: action.startsWith("KYC") ? "kyc_application" : "feature_flag",
    resourceId: "KYC-1",
    resourceLabel: "Applicant",
    changedField: null,
    previousValue: null,
    newValue: null,
    reason: null,
  };
}

const QUEUE = [
  application("KYC-1", "pending", 0),
  application("KYC-2", "pending", 2, "medium"),
  application("KYC-3", "escalated", 5, "high"),
  application("KYC-4", "approved", 9),
  application("KYC-5", "rejected", 9),
];

describe("open queue rollups", () => {
  it("treats undecided cases as open", () => {
    expect(QUEUE.filter(isOpen).map((a) => a.id)).toEqual(["KYC-1", "KYC-2", "KYC-3"]);
  });

  it("counts every status, including the empty ones", () => {
    expect(statusBreakdown(QUEUE)).toEqual({
      pending: 2,
      escalated: 1,
      approved: 1,
      rejected: 1,
    });
  });

  it("mixes risk over open cases only", () => {
    expect(openRiskMix(QUEUE)).toEqual({ low: 1, medium: 1, high: 1 });
  });
});

describe("aging and SLA", () => {
  it("ages open cases in whole days and ignores decided ones", () => {
    expect(ageInDays(QUEUE[1], NOW)).toBe(2);
    expect(ageInDays(QUEUE[3], NOW)).toBeNull();
  });

  it("buckets the open queue against the SLA", () => {
    expect(agingBuckets(QUEUE, NOW, 3)).toEqual([
      { label: "< 1 day", value: 1, breach: false },
      { label: "1–2 days", value: 1, breach: false },
      { label: "3+ days", value: 1, breach: true },
    ]);
  });

  it("lists breaches oldest first and never includes decided cases", () => {
    const older = application("KYC-6", "pending", 12);
    const breaches = slaBreaches([...QUEUE, older], NOW, 3);

    expect(breaches.map((a) => a.id)).toEqual(["KYC-6", "KYC-3"]);
  });
});

describe("daily series", () => {
  it("produces a dense oldest-first window even where nothing happened", () => {
    const series = dailySeries([daysAgo(0), daysAgo(0), daysAgo(2)], NOW, 3);

    expect(series.map((point) => point.value)).toEqual([1, 0, 2]);
    expect(series[2].date).toBe("2026-03-10");
  });

  it("ignores activity outside the window", () => {
    expect(dailySeries([daysAgo(30)], NOW, 3).every((point) => point.value === 0)).toBe(true);
  });

  it("counts submissions and KYC decisions separately", () => {
    const events = [
      event("KYC_APPROVED", "a@x.com", "A", 0),
      event("KYC_REJECTED", "b@x.com", "B", 0),
      event("FLAG_ENABLED", "c@x.com", "C", 0),
    ];

    expect(decisionSeries(events, NOW, 2).map((p) => p.value)).toEqual([0, 2]);
    expect(submissionSeries(QUEUE, NOW, 1).map((p) => p.value)).toEqual([1]);
  });
});

describe("rates", () => {
  it("reports clearance over all cases", () => {
    expect(clearanceRate(QUEUE)).toBe(40);
    expect(clearanceRate([])).toBe(0);
  });

  it("reports approvals as a share of decisions, not of the queue", () => {
    expect(approvalRate(QUEUE)).toBe(50);
  });

  it("has no approval rate before anything is decided", () => {
    expect(approvalRate([application("KYC-9", "pending", 1)])).toBeNull();
  });
});

describe("flagSummary", () => {
  it("summarises production separately from other environments", () => {
    const summary = flagSummary([
      flag("a", "production", true, 100),
      flag("b", "production", true, 50),
      flag("c", "production", false, 0),
      flag("d", "staging", true, 100),
    ]);

    expect(summary).toEqual({
      total: 4,
      enabled: 3,
      production: 3,
      productionEnabled: 2,
      fullyRolledOut: 1,
      partialRollouts: 1,
      averageProductionRollout: 75,
    });
  });

  it("handles a platform with no production flags", () => {
    expect(flagSummary([]).averageProductionRollout).toBe(0);
  });
});

describe("topActors", () => {
  it("counts by identity, case-insensitively, busiest first", () => {
    const actors = topActors([
      event("KYC_APPROVED", "Maya@x.com", "Maya Chen", 1),
      event("KYC_REJECTED", "maya@x.com", "Maya Chen", 2),
      event("FLAG_ENABLED", "sam@x.com", "Sam Rivera", 1),
    ]);

    expect(actors).toEqual([
      { actor: "Maya@x.com", name: "Maya Chen", count: 2 },
      { actor: "sam@x.com", name: "Sam Rivera", count: 1 },
    ]);
  });

  it("respects the limit", () => {
    const events = ["a", "b", "c"].map((id, index) =>
      event("KYC_APPROVED", `${id}@x.com`, id, index),
    );

    expect(topActors(events, 2)).toHaveLength(2);
  });
});

describe("recentSensitiveActions", () => {
  it("counts rejections, escalations and flag changes but not approvals", () => {
    const events = [
      event("KYC_APPROVED", "sam@x.com", "Sam", 0),
      event("KYC_REJECTED", "sam@x.com", "Sam", 0),
      event("KYC_ESCALATED", "maya@x.com", "Maya", 1),
      event("ROLLOUT_CHANGED", "alex@x.com", "Alex", 1),
      event("FLAG_DISABLED", "alex@x.com", "Alex", 9),
    ];

    expect(recentSensitiveActions(events, NOW).map((e) => e.action)).toEqual([
      "KYC_REJECTED",
      "KYC_ESCALATED",
      "ROLLOUT_CHANGED",
    ]);
  });
});
