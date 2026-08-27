import { describe, expect, it } from "vitest";
import { seedReferenceTime } from "@/lib/kyc/seed";
import { isRole, type Role } from "@/lib/auth/rbac";
import { canDecideRefund } from "@/lib/refunds/policy";
import { createSeededPlatform } from "./history";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const BASE = seedReferenceTime(NOW);

describe("seeded platform", () => {
  it("is anchored to the current day rather than a fixed past date", () => {
    const { applications, flags } = createSeededPlatform(BASE);

    const newestCase = Math.max(...applications.map((a) => Date.parse(a.submittedAt)));
    const newestFlag = Math.max(...flags.map((f) => Date.parse(f.updatedAt)));

    expect(NOW.getTime() - newestCase).toBeLessThan(3 * 86_400_000);
    expect(NOW.getTime() - newestFlag).toBeLessThan(3 * 86_400_000);
    expect(newestCase).toBeLessThanOrEqual(NOW.getTime());
  });

  it("ships a queue that has already been worked", () => {
    const { applications, events } = createSeededPlatform(BASE);

    const decided = applications.filter(
      (application) => application.status === "approved" || application.status === "rejected",
    );

    expect(decided.length).toBeGreaterThan(0);
    for (const application of decided) {
      expect(application.decidedAt).not.toBeNull();
      expect(application.decisionReason?.trim()).toBeTruthy();
      expect(events.some((event) => event.resourceId === application.id)).toBe(true);
    }
  });

  it("records escalations before the decision, by a different operator", () => {
    const { events } = createSeededPlatform(BASE);
    const escalations = events.filter((event) => event.action === "KYC_ESCALATED");

    expect(escalations.length).toBeGreaterThan(0);
    for (const escalation of escalations) {
      const decision = events.find(
        (event) =>
          event.resourceId === escalation.resourceId &&
          (event.action === "KYC_APPROVED" || event.action === "KYC_REJECTED"),
      );
      expect(decision).toBeDefined();
      expect(Date.parse(decision!.occurredAt)).toBeGreaterThan(Date.parse(escalation.occurredAt));
      expect(decision!.actor).not.toBe(escalation.actor);
    }
  });

  it("leaves flag state matching the newValue of its last audit event", () => {
    const { flags, events } = createSeededPlatform(BASE);

    for (const event of events.filter((candidate) => candidate.action === "ROLLOUT_CHANGED")) {
      const flag = flags.find((candidate) => candidate.id === event.resourceId);
      expect(flag).toBeDefined();
      expect(`${flag!.rolloutPercentage}%`).toBe(event.newValue);
    }

    for (const event of events.filter(
      (candidate) => candidate.action === "FLAG_ENABLED" || candidate.action === "FLAG_DISABLED",
    )) {
      const flag = flags.find((candidate) => candidate.id === event.resourceId);
      expect(flag!.enabled).toBe(event.action === "FLAG_ENABLED");
      expect(flag!.updatedAt).toBe(event.occurredAt);
    }
  });

  it("records no no-op change", () => {
    const { events } = createSeededPlatform(BASE);

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.previousValue).not.toBe(event.newValue);
    }
  });

  it("only shows refund decisions the acting role was allowed to make", () => {
    const { refunds, events } = createSeededPlatform(BASE);
    const decisions = events.filter(
      (event) => event.action === "REFUND_APPROVED" || event.action === "REFUND_DENIED",
    );

    expect(decisions.length).toBeGreaterThan(0);
    for (const event of decisions) {
      const refund = refunds.find((candidate) => candidate.id === event.resourceId);
      expect(refund).toBeDefined();
      expect(isRole(event.actorRole)).toBe(true);
      expect(
        canDecideRefund(
          event.actorRole as Role,
          event.action === "REFUND_APPROVED" ? "approve" : "deny",
          refund!.requestedAmountCents,
        ),
      ).toBe(true);
    }
  });

  it("is deterministic for a given reference time", () => {
    expect(createSeededPlatform(BASE)).toEqual(createSeededPlatform(BASE));
  });

  it("requires a reason on every rejection and escalation", () => {
    const { events } = createSeededPlatform(BASE);

    for (const event of events) {
      if (event.action === "KYC_REJECTED" || event.action === "KYC_ESCALATED") {
        expect(event.reason?.trim()).toBeTruthy();
      }
    }
  });
});
