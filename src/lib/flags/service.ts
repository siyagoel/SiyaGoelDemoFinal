import { assertPermission, type AuthUser } from "@/lib/auth/rbac";
import { recordFlagChange } from "./store";
import type { FlagResult } from "./mutations";
import type { FlagAction } from "./types";

export interface FlagChangeInput {
  action: FlagAction;
  rolloutPercentage?: number;
  reason?: string | null;
  confirmation?: string | null;
}

/**
 * Authorized entry point for feature flag changes; mirrors the KYC service so
 * every tool enforces permissions in the same place.
 */
export function changeFlag(
  user: AuthUser,
  flagId: string,
  input: FlagChangeInput,
): FlagResult {
  assertPermission(user, "flags:manage");

  return recordFlagChange(flagId, {
    action: input.action,
    actor: user.email,
    actorName: user.name,
    actorRole: user.role,
    rolloutPercentage: input.rolloutPercentage,
    reason: input.reason ?? null,
    confirmation: input.confirmation ?? null,
  });
}
