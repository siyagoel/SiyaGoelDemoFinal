import { beforeEach, describe, expect, it } from "vitest";
import { changeFlag } from "@/lib/flags/service";
import { listFlags, resetFlagStore } from "@/lib/flags/store";
import { decideApplication } from "@/lib/kyc/service";
import { listApplications, resetStore } from "@/lib/kyc/store";
import type { AuthUser } from "@/lib/auth/rbac";
import { buildAuditEvent, queryAuditEvents, recordAuditEvent } from "./service";

const ADMIN: AuthUser = {
  name: "Dana Osei",
  email: "dana.osei@northwind.example",
  role: "admin",
};

function pendingLowRiskApplication() {
  const application = listApplications({ status: "pending" }).find(
    (candidate) => candidate.riskLevel !== "high",
  );
  if (!application) throw new Error("seed data has no pending standard-risk application");
  return application;
}

function productionFlag(predicate: (enabled: boolean) => boolean = () => true) {
  const flag = listFlags({ environment: "production" }).find((candidate) =>
    predicate(candidate.enabled),
  );
  if (!flag) throw new Error("seed data has no matching production flag");
  return flag;
}

beforeEach(() => {
  resetStore();
  resetFlagStore();
});

describe("platform audit log", () => {
  it("records KYC_APPROVED when a case is approved", () => {
    const target = pendingLowRiskApplication();
    decideApplication(ADMIN, target.id, { action: "approve" });

    expect(queryAuditEvents({ resourceId: target.id })).toMatchObject([
      {
        action: "KYC_APPROVED",
        resourceType: "kyc_application",
        resourceId: target.id,
        resourceLabel: target.fullName,
        actor: ADMIN.email,
        actorRole: "admin",
        changedField: "Status",
        newValue: "Approved",
      },
    ]);
  });

  it("records KYC_ESCALATED with the reviewer note when a case is escalated", () => {
    const target = pendingLowRiskApplication();
    decideApplication(ADMIN, target.id, { action: "escalate", reason: "Sanctions hit" });

    expect(queryAuditEvents({ action: "KYC_ESCALATED" })).toMatchObject([
      {
        resourceId: target.id,
        previousValue: "Pending",
        newValue: "Escalated",
        reason: "Sanctions hit",
      },
    ]);
  });

  it("records FLAG_DISABLED when a flag is turned off", () => {
    const flag = productionFlag((enabled) => enabled);
    changeFlag(ADMIN, flag.id, {
      action: "disable",
      reason: "Incident 4412",
      confirmation: flag.key,
    });

    expect(queryAuditEvents({ resourceType: "feature_flag" })).toMatchObject([
      {
        action: "FLAG_DISABLED",
        resourceId: flag.id,
        changedField: "Enabled",
        previousValue: "On",
        newValue: "Off",
        reason: "Incident 4412",
      },
    ]);
  });

  it("records ROLLOUT_CHANGED with the previous and new percentages", () => {
    const flag = productionFlag();
    const rolloutPercentage = flag.rolloutPercentage === 100 ? 50 : 100;
    changeFlag(ADMIN, flag.id, {
      action: "set_rollout",
      rolloutPercentage,
      reason: "Staged rollout completed cleanly",
      confirmation: flag.key,
    });

    expect(queryAuditEvents({ action: "ROLLOUT_CHANGED" })).toMatchObject([
      {
        resourceId: flag.id,
        changedField: "Rollout",
        previousValue: `${flag.rolloutPercentage}%`,
        newValue: `${rolloutPercentage}%`,
        reason: "Staged rollout completed cleanly",
      },
    ]);
  });

  it("serves both tools from one chronological log, newest first", () => {
    const application = pendingLowRiskApplication();
    const flag = productionFlag((enabled) => enabled);
    decideApplication(ADMIN, application.id, { action: "escalate", reason: "Needs L2 review" });
    changeFlag(ADMIN, flag.id, {
      action: "disable",
      reason: "Incident 4412",
      confirmation: flag.key,
    });

    const events = queryAuditEvents();
    expect(events.map((event) => event.action)).toEqual(["FLAG_DISABLED", "KYC_ESCALATED"]);
    expect(queryAuditEvents({ resourceType: "kyc_application" })).toHaveLength(1);
    expect(queryAuditEvents({ actor: ADMIN.email })).toHaveLength(2);
    expect(queryAuditEvents({ actor: "someone.else@northwind.example" })).toHaveLength(0);
  });

  it("filters to sensitive actions inside a time window", () => {
    const application = pendingLowRiskApplication();
    decideApplication(ADMIN, application.id, { action: "approve" });

    recordAuditEvent(
      buildAuditEvent({
        actor: ADMIN.email,
        actorName: ADMIN.name,
        actorRole: ADMIN.role,
        action: "KYC_REJECTED",
        resourceType: "kyc_application",
        resourceId: "KYC-OLD",
        resourceLabel: "Older case",
        reason: "Documents expired",
        occurredAt: new Date(Date.now() - 96 * 3_600_000),
      }),
    );

    expect(queryAuditEvents()).toHaveLength(2);
    expect(queryAuditEvents({ sensitiveOnly: true }).map((event) => event.action)).toEqual([
      "KYC_REJECTED",
    ]);
    expect(queryAuditEvents({ withinHours: 72 }).map((event) => event.action)).toEqual([
      "KYC_APPROVED",
    ]);
    expect(queryAuditEvents({ sensitiveOnly: true, withinHours: 72 })).toHaveLength(0);
  });

  it("keeps recorded events frozen", () => {
    const target = pendingLowRiskApplication();
    decideApplication(ADMIN, target.id, { action: "escalate", reason: "Needs L2 review" });
    const [event] = queryAuditEvents();

    expect(() => {
      Object.assign(event, { actor: "mallory@northwind.example" });
    }).toThrow();
    expect(queryAuditEvents()[0].actor).toBe(ADMIN.email);
  });
});
