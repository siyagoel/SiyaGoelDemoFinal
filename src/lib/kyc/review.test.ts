import { describe, expect, it, beforeEach } from "vitest";
import type { AuditEvent } from "@/lib/audit/types";
import {
  applyReviewAction,
  canApply,
  escalatedBy,
  escalatedByActor,
  requiresEscalationBeforeApproval,
  requiresReviewerNote,
  ReviewError,
} from "./review";
import { createSeedApplications } from "./seed";
import {
  getApplication,
  listApplications,
  listAuditEvents,
  queueSummary,
  recordReviewAction,
  resetStore,
} from "./store";
import type { KycApplication } from "./types";

function baseApplication(overrides: Partial<KycApplication> = {}): KycApplication {
  return {
    id: "KYC-1001",
    fullName: "Test Applicant",
    email: "test@example.com",
    country: "Germany",
    dateOfBirth: "1990-01-01",
    submittedAt: "2024-05-01T10:00:00.000Z",
    riskLevel: "medium",
    riskScore: 55,
    status: "pending",
    flags: [],
    documents: [],
    decidedAt: null,
    decisionReason: null,
    ...overrides,
  };
}

const ACTOR = "reviewer@northwind.example";
const SECOND_ACTOR = "supervisor@northwind.example";
const AT = new Date("2024-05-20T12:00:00.000Z");

function escalationHistory(actor: string): AuditEvent[] {
  return [
    applyReviewAction(baseApplication(), { action: "escalate", actor, reason: "Needs L2 review", occurredAt: AT }).event,
  ];
}

describe("applyReviewAction", () => {
  it("approves a pending application and emits an audit event", () => {
    const application = baseApplication();
    const { application: next, event } = applyReviewAction(application, {
      action: "approve",
      actor: ACTOR,
      occurredAt: AT,
    });

    expect(next.status).toBe("approved");
    expect(next.decidedAt).toBe(AT.toISOString());
    expect(event).toMatchObject({
      resourceType: "kyc_application",
      resourceId: "KYC-1001",
      action: "KYC_APPROVED",
      actor: ACTOR,
      reason: null,
    });
    expect(event).toMatchObject({ changedField: "Status", previousValue: "Pending", newValue: "Approved" });
  });

  it("does not mutate the input application", () => {
    const application = baseApplication();
    applyReviewAction(application, { action: "approve", actor: ACTOR, occurredAt: AT });
    expect(application.status).toBe("pending");
    expect(application.decidedAt).toBeNull();
  });

  it("requires a reason to reject", () => {
    const application = baseApplication();
    expect(() =>
      applyReviewAction(application, { action: "reject", actor: ACTOR, reason: "   " }),
    ).toThrow(ReviewError);
  });

  it("stores the trimmed rejection reason on the application and the event", () => {
    const { application, event } = applyReviewAction(baseApplication(), {
      action: "reject",
      actor: ACTOR,
      reason: "  Sanctions hit confirmed  ",
      occurredAt: AT,
    });

    expect(application.status).toBe("rejected");
    expect(application.decisionReason).toBe("Sanctions hit confirmed");
    expect(event.reason).toBe("Sanctions hit confirmed");
  });

  it("escalates without a decision timestamp", () => {
    const { application, event } = applyReviewAction(baseApplication({ status: "pending" }), {
      action: "escalate",
      actor: ACTOR,
      reason: "Needs L2 review",
      occurredAt: AT,
    });

    expect(application.status).toBe("escalated");
    expect(application.decidedAt).toBeNull();
    expect(event).toMatchObject({ changedField: "Status", previousValue: "Pending", newValue: "Escalated" });
  });

  it("rejects actions on terminal applications", () => {
    for (const status of ["approved", "rejected"] as const) {
      const application = baseApplication({ status });
      for (const action of ["approve", "reject", "escalate"] as const) {
        expect(canApply(application, action)).toBe(false);
        expect(() =>
          applyReviewAction(application, { action, actor: ACTOR, reason: "because" }),
        ).toThrow(ReviewError);
      }
    }
  });

  it("refuses to escalate an already escalated application", () => {
    const application = baseApplication({ status: "escalated" });
    expect(canApply(application, "escalate")).toBe(false);
    expect(() => applyReviewAction(application, { action: "escalate", actor: ACTOR, reason: "Needs L2 review" })).toThrow(
      ReviewError,
    );
    expect(canApply(application, "approve")).toBe(true);
  });

  it("refuses to approve a high-risk application that has not been escalated", () => {
    const application = baseApplication({ riskLevel: "high", riskScore: 88, status: "pending" });
    expect(requiresEscalationBeforeApproval(application)).toBe(true);
    expect(canApply(application, "approve")).toBe(false);
    expect(() =>
      applyReviewAction(application, {
        action: "approve",
        actor: ACTOR,
        reason: "Documents verified",
      }),
    ).toThrow(/must be escalated/);
  });

  it("requires a reviewer note when approving an escalated high-risk application", () => {
    const application = baseApplication({
      riskLevel: "high",
      riskScore: 88,
      status: "escalated",
    });

    expect(requiresReviewerNote(application, "approve")).toBe(true);
    expect(canApply(application, "approve")).toBe(true);
    expect(() =>
      applyReviewAction(application, { action: "approve", actor: ACTOR, reason: "  " }),
    ).toThrow(/reviewer note is required/);
  });

  it("approves a high-risk application once escalated and annotated", () => {
    const { application, event } = applyReviewAction(
      baseApplication({ riskLevel: "high", riskScore: 88, status: "escalated" }),
      {
        action: "approve",
        actor: ACTOR,
        reason: "  L2 review cleared source of funds  ",
        occurredAt: AT,
      },
    );

    expect(application.status).toBe("approved");
    expect(application.decisionReason).toBe("L2 review cleared source of funds");
    expect(event.reason).toBe("L2 review cleared source of funds");
    expect(event).toMatchObject({ changedField: "Status", previousValue: "Escalated", newValue: "Approved" });
  });

  it("leaves low and medium risk approvals unchanged", () => {
    for (const riskLevel of ["low", "medium"] as const) {
      const application = baseApplication({ riskLevel });
      expect(requiresEscalationBeforeApproval(application)).toBe(false);
      expect(requiresReviewerNote(application, "approve")).toBe(false);
      expect(canApply(application, "approve")).toBe(true);
      expect(
        applyReviewAction(application, { action: "approve", actor: ACTOR }).application.status,
      ).toBe("approved");
    }
  });

  it("still allows high-risk applications to be rejected or escalated directly", () => {
    const application = baseApplication({ riskLevel: "high", status: "pending" });
    expect(canApply(application, "escalate")).toBe(true);
    expect(canApply(application, "reject")).toBe(true);
    expect(
      applyReviewAction(application, { action: "escalate", actor: ACTOR, reason: "Needs L2 review" })
        .application.status,
    ).toBe("escalated");
    expect(
      applyReviewAction(application, { action: "reject", actor: ACTOR, reason: "Fraud" })
        .application.status,
    ).toBe("rejected");
  });

  it("refuses an approval by the reviewer who escalated the case", () => {
    const application = baseApplication({ status: "escalated" });
    const history = escalationHistory(ACTOR);

    expect(escalatedBy(history)).toBe(ACTOR);
    expect(escalatedByActor(ACTOR, history)).toBe(true);
    expect(canApply(application, "approve", { actor: ACTOR, history })).toBe(false);
    expect(() =>
      applyReviewAction(application, { action: "approve", actor: ACTOR }, history),
    ).toThrow(/different reviewer/);
  });

  it("matches the escalating reviewer by email regardless of case or padding", () => {
    const history = escalationHistory(ACTOR);
    const sameperson = `  ${ACTOR.toUpperCase()} `;

    expect(escalatedByActor(sameperson, history)).toBe(true);
    expect(() =>
      applyReviewAction(
        baseApplication({ status: "escalated" }),
        { action: "approve", actor: sameperson },
        history,
      ),
    ).toThrow(/different reviewer/);
  });

  it("allows a different reviewer to approve an escalated case", () => {
    const history = escalationHistory(ACTOR);
    const application = baseApplication({ status: "escalated" });

    expect(escalatedByActor(SECOND_ACTOR, history)).toBe(false);
    expect(canApply(application, "approve", { actor: SECOND_ACTOR, history })).toBe(true);
    expect(
      applyReviewAction(application, { action: "approve", actor: SECOND_ACTOR }, history)
        .application.status,
    ).toBe("approved");
  });

  it("refuses a rejection by the reviewer who escalated the case", () => {
    const history = escalationHistory(ACTOR);
    const application = baseApplication({ status: "escalated" });

    expect(canApply(application, "reject", { actor: ACTOR, history })).toBe(false);
    expect(() =>
      applyReviewAction(
        application,
        { action: "reject", actor: ACTOR, reason: "Documents forged" },
        history,
      ),
    ).toThrow(/different reviewer/);
  });

  it("allows a different reviewer to reject an escalated case", () => {
    const history = escalationHistory(ACTOR);
    expect(
      applyReviewAction(
        baseApplication({ status: "escalated" }),
        { action: "reject", actor: SECOND_ACTOR, reason: "Documents forged" },
        history,
      ).application.status,
    ).toBe("rejected");
  });

  it("leaves approvals of never-escalated cases unaffected", () => {
    expect(escalatedBy([])).toBeNull();
    expect(escalatedByActor(ACTOR, [])).toBe(false);
    expect(
      applyReviewAction(baseApplication(), { action: "approve", actor: ACTOR }).application.status,
    ).toBe("approved");
  });

  it("requires an actor", () => {
    expect(() => applyReviewAction(baseApplication(), { action: "approve", actor: " " })).toThrow(
      ReviewError,
    );
  });

  it("returns frozen audit events", () => {
    const { event } = applyReviewAction(baseApplication(), { action: "approve", actor: ACTOR });
    expect(Object.isFrozen(event)).toBe(true);
    expect(() => {
      (event as { reason: string | null }).reason = "tampered";
    }).toThrow();
  });
});

function pendingStandardRisk(): KycApplication {
  const application = listApplications({ status: "pending" }).find(
    (candidate) => candidate.riskLevel !== "high",
  );
  if (!application) throw new Error("Seed data has no pending non-high-risk application.");
  return application;
}

describe("store", () => {
  beforeEach(() => {
    resetStore();
  });

  it("seeds deterministically", () => {
    const first = createSeedApplications();
    const second = createSeedApplications();
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(new Set(first.map((application) => application.id)).size).toBe(first.length);
  });

  it("persists the new status and appends an audit event", () => {
    const target = pendingStandardRisk();
    recordReviewAction(target.id, { action: "escalate", actor: ACTOR, reason: "Needs L2 review" });

    expect(getApplication(target.id)?.status).toBe("escalated");
    const events = listAuditEvents(target.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "KYC_ESCALATED",
      resourceType: "kyc_application",
      newValue: "Escalated",
    });
  });

  it("keeps audit history append-only across multiple actions", () => {
    const target = pendingStandardRisk();
    recordReviewAction(target.id, { action: "escalate", actor: ACTOR, reason: "Needs L2 review" });
    recordReviewAction(target.id, {
      action: "reject",
      actor: SECOND_ACTOR,
      reason: "Fake documents",
    });

    const events = listAuditEvents(target.id);
    expect(events.map((event) => event.action)).toEqual(["KYC_REJECTED", "KYC_ESCALATED"]);
    expect(events.map((event) => event.id)).toHaveLength(new Set(events.map((e) => e.id)).size);
  });

  it("leaves state untouched when an action is invalid", () => {
    const target = pendingStandardRisk();
    recordReviewAction(target.id, { action: "approve", actor: ACTOR });

    expect(() =>
      recordReviewAction(target.id, { action: "reject", actor: ACTOR, reason: "too late" }),
    ).toThrow(ReviewError);
    expect(getApplication(target.id)?.status).toBe("approved");
    expect(listAuditEvents(target.id)).toHaveLength(1);
  });

  it("enforces the high-risk escalation policy through the store", () => {
    const target = listApplications({ status: "pending", risk: "high" })[0];

    expect(() => recordReviewAction(target.id, { action: "approve", actor: ACTOR })).toThrow(
      ReviewError,
    );
    expect(getApplication(target.id)?.status).toBe("pending");
    expect(listAuditEvents(target.id)).toHaveLength(0);

    recordReviewAction(target.id, { action: "escalate", actor: ACTOR, reason: "Needs L2 review" });
    expect(() =>
      recordReviewAction(target.id, { action: "approve", actor: SECOND_ACTOR }),
    ).toThrow(ReviewError);

    recordReviewAction(target.id, {
      action: "approve",
      actor: SECOND_ACTOR,
      reason: "Enhanced due diligence complete",
    });
    expect(getApplication(target.id)?.status).toBe("approved");
    expect(listAuditEvents(target.id).map((event) => event.action)).toEqual([
      "KYC_APPROVED",
      "KYC_ESCALATED",
    ]);
  });

  it("enforces four-eyes approval through the store", () => {
    const target = pendingStandardRisk();
    recordReviewAction(target.id, { action: "escalate", actor: ACTOR, reason: "Needs L2" });

    expect(() => recordReviewAction(target.id, { action: "approve", actor: ACTOR })).toThrow(
      /different reviewer/,
    );
    expect(getApplication(target.id)?.status).toBe("escalated");
    expect(listAuditEvents(target.id)).toHaveLength(1);

    recordReviewAction(target.id, { action: "approve", actor: SECOND_ACTOR });
    expect(getApplication(target.id)?.status).toBe("approved");
    expect(listAuditEvents(target.id).map((event) => event.actor)).toEqual([
      SECOND_ACTOR,
      ACTOR,
    ]);
  });

  it("throws for unknown applications", () => {
    expect(() => recordReviewAction("KYC-9999", { action: "approve", actor: ACTOR })).toThrow(
      /Unknown application/,
    );
    expect(listApplications({ status: "pending", risk: "high" }).length).toBeGreaterThan(0);
  });

  it("filters by search term, status and risk", () => {
    const all = listApplications();
    const target = all[0];

    expect(listApplications({ search: target.email }).map((a) => a.id)).toContain(target.id);
    expect(listApplications({ search: target.id.toLowerCase() })).toHaveLength(1);
    expect(
      listApplications({ risk: "high" }).every((application) => application.riskLevel === "high"),
    ).toBe(true);
    expect(
      listApplications({ status: "pending" }).every(
        (application) => application.status === "pending",
      ),
    ).toBe(true);
    expect(listApplications({ search: "no-such-applicant" })).toHaveLength(0);
  });

  it("treats status 'open' as every undecided application", () => {
    const open = listApplications({ status: "open" });
    const summary = queueSummary();

    expect(open).toHaveLength(summary.pending + summary.escalated);
    expect(open.every((application) => ["pending", "escalated"].includes(application.status))).toBe(
      true,
    );
    expect(listApplications({ status: "open", risk: "high" })).toHaveLength(summary.highRisk);
  });
});
