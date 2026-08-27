import {
  can,
  deniedMessage,
  ROLE_LABELS,
  type Permission,
  type Role,
} from "@/lib/auth/rbac";
import { formatMoney } from "@/lib/format";
import type { RefundDecision } from "./types";

/**
 * Company approval control for refunds, expressed once.
 *
 * Anything at or above the threshold needs elevated authorization; changing the
 * limit means changing this constant, and the rule is expressed as a permission
 * lookup so the service layer, the UI and the tests all read the same policy.
 */
export const HIGH_VALUE_REFUND_THRESHOLD_CENTS = 50_000;

export function isHighValueRefund(amountCents: number): boolean {
  return amountCents >= HIGH_VALUE_REFUND_THRESHOLD_CENTS;
}

/** Every permission a decision needs; all of them must be granted. */
export function permissionsForDecision(
  decision: RefundDecision,
  amountCents: number,
): Permission[] {
  const permissions: Permission[] = ["refunds:decide"];
  if (isHighValueRefund(amountCents)) {
    permissions.push("refunds:decide_high_value");
  }
  return permissions;
}

export function canDecideRefund(
  role: Role,
  decision: RefundDecision,
  amountCents: number,
): boolean {
  return permissionsForDecision(decision, amountCents).every((permission) =>
    can(role, permission),
  );
}

/** Why a decision is unavailable to this role, or null when it is allowed. */
export function decisionBlockedMessage(
  role: Role,
  decision: RefundDecision,
  amountCents: number,
): string | null {
  const missing = permissionsForDecision(decision, amountCents).find(
    (permission) => !can(role, permission),
  );
  if (!missing) return null;
  if (missing === "refunds:decide_high_value") {
    return `Refunds of ${formatMoney(
      HIGH_VALUE_REFUND_THRESHOLD_CENTS,
    )} or more are decided by an Admin. Your role (${ROLE_LABELS[role]}) can review this request but not ${
      decision === "approve" ? "approve" : "deny"
    } it.`;
  }
  return deniedMessage(role, missing);
}
