import { assertPermission, type AuthUser } from "@/lib/auth/rbac";
import { RefundError, type RefundResult } from "./mutations";
import { permissionsForDecision } from "./policy";
import { getRefund, recordRefundDecision } from "./store";
import type { RefundDecision } from "./types";

export interface RefundDecisionInput {
  decision: RefundDecision;
  reason?: string | null;
}

/**
 * Authorized entry point for refund decisions. The high-value control is
 * applied here rather than in the UI, so a direct call is refused too.
 */
export function decideRefund(
  user: AuthUser,
  refundId: string,
  input: RefundDecisionInput,
): RefundResult {
  const refund = getRefund(refundId);
  if (!refund) {
    throw new RefundError(`Unknown refund request ${refundId}`);
  }

  for (const permission of permissionsForDecision(
    input.decision,
    refund.requestedAmountCents,
  )) {
    assertPermission(user, permission);
  }

  return recordRefundDecision(refundId, {
    decision: input.decision,
    actor: user.email,
    actorName: user.name,
    actorRole: user.role,
    reason: input.reason ?? null,
  });
}
