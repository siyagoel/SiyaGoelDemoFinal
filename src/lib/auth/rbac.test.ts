import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, can, type AuthUser, type Role } from "@/lib/auth/rbac";
import { changeFlag } from "@/lib/flags/service";
import { getFlag, listFlagAuditEvents, listFlags, resetFlagStore } from "@/lib/flags/store";
import { decideApplication } from "@/lib/kyc/service";
import { getApplication, listApplications, listAuditEvents, resetStore } from "@/lib/kyc/store";

function user(role: Role): AuthUser {
  return { name: `${role} user`, email: `${role}@northwind.example`, role };
}

const REVIEWER = user("reviewer");
const ENGINEER = user("engineer");
const ADMIN = user("admin");

function pendingLowRiskApplication() {
  const application = listApplications({ status: "pending" }).find(
    (candidate) => candidate.riskLevel !== "high",
  );
  if (!application) throw new Error("seed data has no pending standard-risk application");
  return application;
}

function productionFlag() {
  const flag = listFlags({ environment: "production" })[0];
  if (!flag) throw new Error("seed data has no production flag");
  return flag;
}

beforeEach(() => {
  resetStore();
  resetFlagStore();
});

describe("role permissions", () => {
  it("grants each role the documented permissions", () => {
    expect(can("reviewer", "kyc:decide")).toBe(true);
    expect(can("reviewer", "flags:view")).toBe(true);
    expect(can("reviewer", "flags:manage")).toBe(false);

    expect(can("engineer", "flags:manage")).toBe(true);
    expect(can("engineer", "kyc:view")).toBe(true);
    expect(can("engineer", "kyc:decide")).toBe(false);

    expect(can("admin", "kyc:decide")).toBe(true);
    expect(can("admin", "flags:manage")).toBe(true);
  });
});

describe("kyc service authorization", () => {
  it("lets a reviewer decide a case and records their role in the audit event", () => {
    const target = pendingLowRiskApplication();

    const { event } = decideApplication(REVIEWER, target.id, {
      action: "reject",
      reason: "Document mismatch",
    });

    expect(getApplication(target.id)?.status).toBe("rejected");
    expect(event.actor).toBe(REVIEWER.email);
    expect(event.actorRole).toBe("reviewer");
  });

  it("rejects an engineer's KYC decision at the service layer", () => {
    const target = pendingLowRiskApplication();

    expect(() =>
      decideApplication(ENGINEER, target.id, { action: "escalate", reason: "Looks odd" }),
    ).toThrow(AuthorizationError);
    expect(getApplication(target.id)?.status).toBe(target.status);
    expect(listAuditEvents(target.id)).toHaveLength(0);
  });

  it("lets an admin decide a case", () => {
    const target = pendingLowRiskApplication();

    decideApplication(ADMIN, target.id, { action: "approve" });

    expect(getApplication(target.id)?.status).toBe("approved");
  });
});

describe("feature flag service authorization", () => {
  it("lets an engineer change a flag and records their role", () => {
    const flag = productionFlag();

    const { event } = changeFlag(ENGINEER, flag.id, {
      action: "set_rollout",
      rolloutPercentage: flag.rolloutPercentage === 25 ? 50 : 25,
      reason: "Ramping after load test",
      confirmation: flag.key,
    });

    expect(event.actor).toBe(ENGINEER.email);
    expect(event.actorRole).toBe("engineer");
    expect(getFlag(flag.id)?.rolloutPercentage).not.toBe(flag.rolloutPercentage);
  });

  it("rejects a reviewer's flag change at the service layer", () => {
    const flag = productionFlag();

    expect(() =>
      changeFlag(REVIEWER, flag.id, { action: flag.enabled ? "disable" : "enable" }),
    ).toThrow(AuthorizationError);
    expect(getFlag(flag.id)?.enabled).toBe(flag.enabled);
    expect(listFlagAuditEvents(flag.id)).toHaveLength(0);
  });

  it("lets an admin change a flag", () => {
    const flag = productionFlag();

    changeFlag(ADMIN, flag.id, {
      action: flag.enabled ? "disable" : "enable",
      reason: "Incident mitigation",
      confirmation: flag.key,
    });

    expect(getFlag(flag.id)?.enabled).toBe(!flag.enabled);
  });
});
