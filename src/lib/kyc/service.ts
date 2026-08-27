import { assertPermission, type AuthUser } from "@/lib/auth/rbac";
import { recordReviewAction } from "./store";
import type { ReviewResult } from "./review";
import type { ReviewAction } from "./types";

export interface DecisionInput {
  action: ReviewAction;
  reason?: string | null;
}

/**
 * Authorized entry point for KYC decisions. Server actions call this instead of
 * the store, so an unauthorized request is rejected even when it bypasses the UI.
 */
export function decideApplication(
  user: AuthUser,
  applicationId: string,
  input: DecisionInput,
): ReviewResult {
  assertPermission(user, "kyc:decide");

  return recordReviewAction(applicationId, {
    action: input.action,
    actor: user.email,
    actorName: user.name,
    actorRole: user.role,
    reason: input.reason ?? null,
  });
}
