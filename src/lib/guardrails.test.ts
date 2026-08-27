import { beforeEach, describe, expect, it } from "vitest";
import { asAuthUser, demoUserById } from "./auth/session";
import {
  FlagError,
  requiresConfirmation,
  requiresReasonForChange,
  requiresTypedConfirmation,
} from "./flags/mutations";
import { changeFlag } from "./flags/service";
import { getFlag, listFlagAuditEvents, listFlags, resetFlagStore } from "./flags/store";
import { requiresReviewerNote, ReviewError, SEPARATION_OF_DUTIES_MESSAGE } from "./kyc/review";
import { decideApplication } from "./kyc/service";
import { getApplication, listApplications, listAuditEvents, resetStore } from "./kyc/store";

const MAYA = asAuthUser(demoUserById("maya.chen"), "reviewer");
const JORDAN = asAuthUser(demoUserById("jordan.patel"), "reviewer");
const ENGINEER = asAuthUser(demoUserById("alex.thompson"), "engineer");

function pendingStandardRiskApplication() {
  const application = listApplications({ status: "pending" }).find(
    (candidate) => candidate.riskLevel !== "high",
  );
  if (!application) throw new Error("seed data has no pending standard-risk application");
  return application;
}

beforeEach(() => {
  resetStore();
  resetFlagStore();
});

describe("KYC reason guardrails", () => {
  it("requires a reason to reject or escalate, at the service layer", () => {
    const { id } = pendingStandardRiskApplication();

    for (const [action, reason] of [
      ["reject", ""],
      ["reject", "   "],
      ["escalate", ""],
      ["escalate", "\n\t "],
    ] as const) {
      expect(() => decideApplication(MAYA, id, { action, reason })).toThrow(ReviewError);
    }

    expect(getApplication(id)?.status).toBe("pending");
    expect(listAuditEvents(id)).toHaveLength(0);
  });

  it("stores trimmed rejection and escalation reasons on the shared audit log", () => {
    const escalated = pendingStandardRiskApplication();
    decideApplication(MAYA, escalated.id, {
      action: "escalate",
      reason: "  Sanctions screening hit needs a second opinion  ",
    });

    const [escalation] = listAuditEvents(escalated.id);
    expect(escalation).toMatchObject({
      action: "KYC_ESCALATED",
      actor: "maya.chen@fintech-demo.com",
      actorName: "Maya Chen",
      actorRole: "reviewer",
      reason: "Sanctions screening hit needs a second opinion",
    });

    decideApplication(JORDAN, escalated.id, {
      action: "reject",
      reason: "Identity document could not be verified",
    });
    expect(listAuditEvents(escalated.id)[0]).toMatchObject({
      action: "KYC_REJECTED",
      actor: "jordan.patel@fintech-demo.com",
      reason: "Identity document could not be verified",
    });
    expect(getApplication(escalated.id)?.status).toBe("rejected");
  });

  it("flags reject and escalate as reason-required actions for the UI", () => {
    const application = pendingStandardRiskApplication();
    expect(requiresReviewerNote(application, "reject")).toBe(true);
    expect(requiresReviewerNote(application, "escalate")).toBe(true);
    expect(requiresReviewerNote(application, "approve")).toBe(false);
    expect(requiresReviewerNote({ ...application, riskLevel: "high" }, "approve")).toBe(true);
  });

  it("keeps RBAC and separation of duties in force alongside the reason rules", () => {
    const application = pendingStandardRiskApplication();
    expect(() =>
      decideApplication(ENGINEER, application.id, { action: "escalate", reason: "Looks odd" }),
    ).toThrow(/not allowed/i);

    decideApplication(MAYA, application.id, { action: "escalate", reason: "Needs review" });
    for (const action of ["approve", "reject"] as const) {
      expect(() =>
        decideApplication(MAYA, application.id, { action, reason: "Changed my mind" }),
      ).toThrow(SEPARATION_OF_DUTIES_MESSAGE);
    }

    decideApplication(JORDAN, application.id, { action: "approve", reason: "Cleared" });
    expect(getApplication(application.id)?.status).toBe("approved");
  });
});

describe("feature flag guardrails", () => {
  const PRODUCTION_FLAG = "virtual-cards:production";
  const STAGING_FLAG = "virtual-cards:staging";

  it("confirms every change, and asks production for a reason and the typed key", () => {
    expect(requiresConfirmation()).toBe(true);

    expect(requiresReasonForChange(getFlag(PRODUCTION_FLAG)!)).toBe(true);
    expect(requiresTypedConfirmation(getFlag(PRODUCTION_FLAG)!)).toBe(true);
    expect(requiresReasonForChange(getFlag(STAGING_FLAG)!)).toBe(false);
    expect(requiresTypedConfirmation(getFlag(STAGING_FLAG)!)).toBe(false);
  });

  it("rejects any production change without a reason at the service layer", () => {
    const before = getFlag(PRODUCTION_FLAG)!;

    for (const reason of [null, "   "]) {
      expect(() =>
        changeFlag(ENGINEER, PRODUCTION_FLAG, {
          action: "set_rollout",
          rolloutPercentage: 100,
          reason,
          confirmation: "virtual-cards",
        }),
      ).toThrow(FlagError);
      expect(() =>
        changeFlag(ENGINEER, PRODUCTION_FLAG, {
          action: before.enabled ? "disable" : "enable",
          reason,
          confirmation: "virtual-cards",
        }),
      ).toThrow(FlagError);
    }

    expect(getFlag(PRODUCTION_FLAG)).toEqual(before);
    expect(listFlagAuditEvents(PRODUCTION_FLAG)).toHaveLength(0);
  });

  it("rejects a production change until the flag key is typed back", () => {
    const before = getFlag(PRODUCTION_FLAG)!;

    for (const confirmation of [null, "", "virtual-card", "virtualcards", PRODUCTION_FLAG]) {
      expect(() =>
        changeFlag(ENGINEER, PRODUCTION_FLAG, {
          action: "set_rollout",
          rolloutPercentage: 100,
          reason: "Completed staged rollout",
          confirmation,
        }),
      ).toThrow(FlagError);
    }

    expect(getFlag(PRODUCTION_FLAG)).toEqual(before);
    expect(listFlagAuditEvents(PRODUCTION_FLAG)).toHaveLength(0);
  });

  it("stores the reason for a valid production rollout to 100%", () => {
    const before = getFlag(PRODUCTION_FLAG)!;
    changeFlag(ENGINEER, PRODUCTION_FLAG, {
      action: "set_rollout",
      rolloutPercentage: 100,
      reason: "Completed staged rollout with no elevated error rate",
      confirmation: "  Virtual-Cards  ",
    });

    expect(getFlag(PRODUCTION_FLAG)?.rolloutPercentage).toBe(100);
    expect(listFlagAuditEvents(PRODUCTION_FLAG)[0]).toMatchObject({
      action: "ROLLOUT_CHANGED",
      actor: "alex.thompson@fintech-demo.com",
      actorName: "Alex Thompson",
      actorRole: "engineer",
      previousValue: `${before.rolloutPercentage}%`,
      newValue: "100%",
      reason: "Completed staged rollout with no elevated error rate",
    });
  });

  it("leaves non-production rollouts and reviewer permissions unchanged", () => {
    const staging = listFlags({ environment: "staging" }).find(
      (flag) => flag.rolloutPercentage !== 100,
    )!;
    changeFlag(ENGINEER, staging.id, { action: "set_rollout", rolloutPercentage: 100 });
    expect(getFlag(staging.id)?.rolloutPercentage).toBe(100);

    expect(() =>
      changeFlag(JORDAN, staging.id, { action: "set_rollout", rolloutPercentage: 20 }),
    ).toThrow(/not allowed/i);
  });
});
