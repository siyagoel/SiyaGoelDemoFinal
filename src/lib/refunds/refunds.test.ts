import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError } from "@/lib/auth/rbac";
import { asAuthUser, demoUserById } from "@/lib/auth/session";
import { queryAuditEvents } from "@/lib/audit/service";
import { RefundError } from "./mutations";
import {
  canDecideRefund,
  HIGH_VALUE_REFUND_THRESHOLD_CENTS,
  isHighValueRefund,
} from "./policy";
import { decideRefund } from "./service";
import { getRefund, listRefundAuditEvents, listRefunds, resetRefundStore } from "./store";

const REVIEWER = asAuthUser(demoUserById("maya.chen"), "reviewer");
const ADMIN = asAuthUser(demoUserById("jordan.patel"), "admin");
const ENGINEER = asAuthUser(demoUserById("alex.thompson"), "engineer");

function pending(predicate: (amountCents: number) => boolean) {
  const refund = listRefunds({ status: "pending" }).find((candidate) =>
    predicate(candidate.requestedAmountCents),
  );
  if (!refund) throw new Error("seed data is missing a matching pending refund");
  return refund;
}

const standardValue = () => pending((cents) => !isHighValueRefund(cents));
const highValue = () => pending(isHighValueRefund);

beforeEach(() => {
  resetRefundStore();
});

describe("refund policy", () => {
  it("puts the threshold itself on the elevated side of the line", () => {
    expect(isHighValueRefund(HIGH_VALUE_REFUND_THRESHOLD_CENTS - 1)).toBe(false);
    expect(isHighValueRefund(HIGH_VALUE_REFUND_THRESHOLD_CENTS)).toBe(true);
  });

  it("maps roles to the decisions they may take", () => {
    const low = HIGH_VALUE_REFUND_THRESHOLD_CENTS - 1;
    const high = HIGH_VALUE_REFUND_THRESHOLD_CENTS;

    expect(canDecideRefund("reviewer", "approve", low)).toBe(true);
    expect(canDecideRefund("reviewer", "approve", high)).toBe(false);
    expect(canDecideRefund("reviewer", "deny", high)).toBe(false);
    expect(canDecideRefund("reviewer", "deny", low)).toBe(true);
    expect(canDecideRefund("admin", "deny", high)).toBe(true);
    expect(canDecideRefund("admin", "approve", high)).toBe(true);
    expect(canDecideRefund("engineer", "approve", low)).toBe(false);
    expect(canDecideRefund("engineer", "deny", low)).toBe(false);
  });
});

describe("refund decisions", () => {
  it("lets an authorized reviewer approve below the threshold", () => {
    const refund = standardValue();
    const { refund: decided } = decideRefund(REVIEWER, refund.id, { decision: "approve" });

    expect(decided.status).toBe("approved");
    expect(decided.reviewer).toBe("Maya Chen");
    expect(getRefund(refund.id)?.status).toBe("approved");
  });

  it("records an approval on the shared audit log", () => {
    const refund = standardValue();
    decideRefund(REVIEWER, refund.id, { decision: "approve" });

    const [event] = listRefundAuditEvents(refund.id);
    expect(event).toMatchObject({
      action: "REFUND_APPROVED",
      resourceType: "refund_request",
      resourceId: refund.id,
      actor: "maya.chen@fintech-demo.com",
      actorName: "Maya Chen",
      actorRole: "reviewer",
      previousValue: "Pending",
      newValue: "Approved",
      reason: null,
    });
    expect(event.resourceLabel).toContain("$");
    expect(queryAuditEvents({ action: "REFUND_APPROVED" })).toHaveLength(1);
  });

  it("records a denial with its trimmed reason", () => {
    const refund = standardValue();
    decideRefund(REVIEWER, refund.id, {
      decision: "deny",
      reason: "  Merchant provided proof of delivery  ",
    });

    expect(getRefund(refund.id)?.decisionReason).toBe(
      "Merchant provided proof of delivery",
    );
    expect(listRefundAuditEvents(refund.id)[0]).toMatchObject({
      action: "REFUND_DENIED",
      newValue: "Denied",
      reason: "Merchant provided proof of delivery",
    });
  });

  it("refuses a denial without a reason, leaving no trace", () => {
    const refund = standardValue();

    for (const reason of [null, "", "   \n"]) {
      expect(() => decideRefund(REVIEWER, refund.id, { decision: "deny", reason })).toThrow(
        RefundError,
      );
    }

    expect(getRefund(refund.id)?.status).toBe("pending");
    expect(listRefundAuditEvents(refund.id)).toHaveLength(0);
  });

  it("refuses to change a refund that was already decided", () => {
    const refund = standardValue();
    decideRefund(REVIEWER, refund.id, { decision: "approve" });

    expect(() => decideRefund(ADMIN, refund.id, { decision: "deny", reason: "Changed mind" })).toThrow(
      RefundError,
    );
    expect(listRefundAuditEvents(refund.id)).toHaveLength(1);
  });
});

describe("service-layer authorization", () => {
  it("refuses every decision from a role that cannot decide refunds", () => {
    const refund = standardValue();

    expect(() => decideRefund(ENGINEER, refund.id, { decision: "approve" })).toThrow(
      AuthorizationError,
    );
    expect(() =>
      decideRefund(ENGINEER, refund.id, { decision: "deny", reason: "Not my call" }),
    ).toThrow(AuthorizationError);

    expect(getRefund(refund.id)?.status).toBe("pending");
    expect(listRefundAuditEvents(refund.id)).toHaveLength(0);
  });

  it("blocks a reviewer from deciding at or above the threshold, even when called directly", () => {
    const refund = highValue();

    expect(() => decideRefund(REVIEWER, refund.id, { decision: "approve" })).toThrow(
      AuthorizationError,
    );
    expect(() =>
      decideRefund(REVIEWER, refund.id, {
        decision: "deny",
        reason: "Chargeback already filed",
      }),
    ).toThrow(AuthorizationError);

    expect(getRefund(refund.id)?.status).toBe("pending");
    expect(listRefundAuditEvents(refund.id)).toHaveLength(0);
  });

  it("lets an admin approve or deny a high-value refund", () => {
    const { refund: approved } = decideRefund(ADMIN, highValue().id, { decision: "approve" });
    expect(approved.status).toBe("approved");
    expect(listRefundAuditEvents(approved.id)[0]).toMatchObject({
      action: "REFUND_APPROVED",
      actorRole: "admin",
    });

    const { refund: denied } = decideRefund(ADMIN, highValue().id, {
      decision: "deny",
      reason: "Chargeback already filed",
    });
    expect(denied.status).toBe("denied");
  });

  it("refuses an unknown refund id", () => {
    expect(() => decideRefund(ADMIN, "RFD-0000", { decision: "approve" })).toThrow(RefundError);
  });
});

describe("refund queue filters", () => {
  it("filters by status, risk, value band and request date", () => {
    expect(listRefunds({ status: "pending" }).every((r) => r.status === "pending")).toBe(true);
    expect(listRefunds({ risk: "high" }).every((r) => r.riskLevel === "high")).toBe(true);
    expect(
      listRefunds({ value: "high_value" }).every((r) =>
        isHighValueRefund(r.requestedAmountCents),
      ),
    ).toBe(true);
    expect(
      listRefunds({ value: "standard" }).every(
        (r) => !isHighValueRefund(r.requestedAmountCents),
      ),
    ).toBe(true);

    const recent = listRefunds({ withinDays: 1 });
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThan(listRefunds().length);
  });

  it("searches customer, merchant and identifiers", () => {
    const [refund] = listRefunds();
    expect(listRefunds({ search: refund.customerName.toLowerCase() })).toContainEqual(refund);
    expect(listRefunds({ search: refund.transactionId })).toContainEqual(refund);
  });
});
