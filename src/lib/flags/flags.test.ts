import { beforeEach, describe, expect, it } from "vitest";
import { listAuditEvents as listAllAuditEvents } from "@/lib/audit/log";
import { recordReviewAction } from "@/lib/kyc/store";
import { applyFlagChange, FlagError, isValidRollout } from "./mutations";
import { createSeedFlags } from "./seed";
import {
  getFlag,
  listFeatures,
  listFlagAuditEvents,
  listFlags,
  recordFlagChange,
  resetFlagStore,
} from "./store";
import type { FeatureFlag } from "./types";

function baseFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: "instant-payouts:production",
    key: "instant-payouts",
    name: "Instant payouts",
    description: "Settle payouts within minutes.",
    environment: "production",
    enabled: true,
    rolloutPercentage: 25,
    owner: "payments@northwind.example",
    updatedAt: "2024-05-16T08:00:00.000Z",
    ...overrides,
  };
}

const ACTOR = "sam.rivera@northwind.example";
const AT = new Date("2024-05-20T12:00:00.000Z");

/** Every production change carries a reason and the retyped flag key. */
const PRODUCTION_APPROVAL = {
  reason: "Ramp after load test",
  confirmation: "instant-payouts",
};

describe("applyFlagChange", () => {
  it("disables an enabled flag and records the change", () => {
    const staging = baseFlag({ id: "instant-payouts:staging", environment: "staging" });
    const { flag, event } = applyFlagChange(staging, {
      action: "disable",
      actor: ACTOR,
      occurredAt: AT,
    });

    expect(flag.enabled).toBe(false);
    expect(flag.updatedAt).toBe(AT.toISOString());
    expect(event).toMatchObject({
      resourceType: "feature_flag",
      resourceId: "instant-payouts:staging",
      action: "FLAG_DISABLED",
      actor: ACTOR,
      reason: null,
    });
    expect(event).toMatchObject({ changedField: "Enabled", previousValue: "On", newValue: "Off" });
  });

  it("enables a disabled flag", () => {
    const { flag, event } = applyFlagChange(baseFlag({ enabled: false }), {
      ...PRODUCTION_APPROVAL,
      action: "enable",
      actor: ACTOR,
      reason: "  Ramp after load test  ",
      occurredAt: AT,
    });

    expect(flag.enabled).toBe(true);
    expect(event).toMatchObject({ changedField: "Enabled", previousValue: "Off", newValue: "On" });
    expect(event.reason).toBe("Ramp after load test");
  });

  it("does not mutate the input flag", () => {
    const flag = baseFlag();
    applyFlagChange(flag, {
      ...PRODUCTION_APPROVAL,
      action: "set_rollout",
      actor: ACTOR,
      rolloutPercentage: 80,
    });
    expect(flag.rolloutPercentage).toBe(25);
    expect(flag.updatedAt).toBe("2024-05-16T08:00:00.000Z");
  });

  it("changes the rollout percentage", () => {
    const { flag, event } = applyFlagChange(baseFlag(), {
      ...PRODUCTION_APPROVAL,
      action: "set_rollout",
      actor: ACTOR,
      rolloutPercentage: 100,
      reason: "Staged rollout completed cleanly",
      occurredAt: AT,
    });

    expect(flag.rolloutPercentage).toBe(100);
    expect(event).toMatchObject({ changedField: "Rollout", previousValue: "25%", newValue: "100%" });
  });

  it("rejects rollout values outside 0-100 and non-integers", () => {
    for (const rolloutPercentage of [-1, 101, 12.5, Number.NaN]) {
      expect(isValidRollout(rolloutPercentage)).toBe(false);
      expect(() =>
        applyFlagChange(baseFlag(), { action: "set_rollout", actor: ACTOR, rolloutPercentage }),
      ).toThrow(FlagError);
    }
    expect(isValidRollout(0)).toBe(true);
    expect(isValidRollout(100)).toBe(true);
  });

  it("requires a rollout percentage for set_rollout", () => {
    expect(() => applyFlagChange(baseFlag(), { action: "set_rollout", actor: ACTOR })).toThrow(
      FlagError,
    );
  });

  it("rejects no-op changes", () => {
    expect(() => applyFlagChange(baseFlag(), { action: "enable", actor: ACTOR })).toThrow(FlagError);
    expect(() =>
      applyFlagChange(baseFlag({ enabled: false }), { action: "disable", actor: ACTOR }),
    ).toThrow(FlagError);
    expect(() =>
      applyFlagChange(baseFlag(), { action: "set_rollout", actor: ACTOR, rolloutPercentage: 25 }),
    ).toThrow(FlagError);
  });

  it("requires an actor", () => {
    expect(() => applyFlagChange(baseFlag(), { action: "disable", actor: "  " })).toThrow(FlagError);
  });

  it("returns frozen audit events", () => {
    const { event } = applyFlagChange(baseFlag(), {
      ...PRODUCTION_APPROVAL,
      action: "disable",
      actor: ACTOR,
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(() => {
      (event as { actor: string }).actor = "someone.else@northwind.example";
    }).toThrow();
  });
});

describe("flag store", () => {
  beforeEach(() => {
    resetFlagStore();
  });

  it("seeds every flag in every environment deterministically", () => {
    expect(createSeedFlags()).toEqual(createSeedFlags());
    const flags = listFlags();
    const keys = new Set(flags.map((flag) => flag.key));
    expect(flags).toHaveLength(keys.size * 3);
    expect(new Set(flags.map((flag) => flag.id)).size).toBe(flags.length);
  });

  it("persists changes and appends an audit event", () => {
    recordFlagChange("kyc-auto-approve:production", {
      action: "enable",
      actor: ACTOR,
      reason: "Pilot for low-risk applicants",
      confirmation: "kyc-auto-approve",
    });

    expect(getFlag("kyc-auto-approve:production")?.enabled).toBe(true);
    const events = listFlagAuditEvents("kyc-auto-approve:production");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "FLAG_ENABLED",
      reason: "Pilot for low-risk applicants",
    });
  });

  it("leaves state untouched when a change is invalid", () => {
    recordFlagChange("risk-model-v3:staging", { action: "enable", actor: ACTOR });
    expect(() =>
      recordFlagChange("risk-model-v3:staging", { action: "enable", actor: ACTOR }),
    ).toThrow(FlagError);
    expect(() =>
      recordFlagChange("risk-model-v3:staging", {
        action: "set_rollout",
        actor: ACTOR,
        rolloutPercentage: 120,
      }),
    ).toThrow(FlagError);

    expect(getFlag("risk-model-v3:staging")?.enabled).toBe(true);
    expect(listFlagAuditEvents("risk-model-v3:staging")).toHaveLength(1);
  });

  it("only affects the targeted environment", () => {
    recordFlagChange("virtual-cards:staging", {
      action: "set_rollout",
      actor: ACTOR,
      rolloutPercentage: 10,
    });

    expect(getFlag("virtual-cards:staging")?.rolloutPercentage).toBe(10);
    expect(getFlag("virtual-cards:production")?.rolloutPercentage).toBe(60);
  });

  it("throws for unknown flags", () => {
    expect(() => recordFlagChange("nope:production", { action: "enable", actor: ACTOR })).toThrow(
      /Unknown feature flag/,
    );
  });

  it("filters by search term, environment and state", () => {
    expect(listFlags({ search: "payouts" }).every((flag) => flag.key === "instant-payouts")).toBe(
      true,
    );
    expect(
      listFlags({ environment: "production" }).every((flag) => flag.environment === "production"),
    ).toBe(true);
    expect(listFlags({ state: "disabled" }).every((flag) => !flag.enabled)).toBe(true);
    expect(listFlags({ search: "no-such-flag" })).toHaveLength(0);
  });

  it("filters to a single feature across its environments", () => {
    const features = listFeatures();
    expect(features.map((feature) => feature.key)).toContain("instant-payouts");
    expect(new Set(features.map((feature) => feature.key)).size).toBe(features.length);

    const rows = listFlags({ key: "instant-payouts" });
    expect(rows.map((flag) => flag.environment)).toEqual([
      "development",
      "production",
      "staging",
    ]);
    expect(listFlags({ key: "instant-payouts", environment: "production" })).toHaveLength(1);
  });

  it("shares one append-only audit log with the KYC tool", () => {
    recordFlagChange("virtual-cards:production", {
      action: "disable",
      actor: ACTOR,
      reason: "Incident 4412",
      confirmation: "virtual-cards",
    });
    recordReviewAction("KYC-1001", { action: "approve", actor: ACTOR });

    const all = listAllAuditEvents();
    expect(all.map((event) => event.resourceType)).toEqual(["kyc_application", "feature_flag"]);
    expect(new Set(all.map((event) => event.id)).size).toBe(all.length);
    expect(listFlagAuditEvents()).toHaveLength(1);
  });
});
