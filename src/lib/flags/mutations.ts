import { buildAuditEvent } from "@/lib/audit/service";
import type { AuditAction, AuditEvent } from "@/lib/audit/types";
import { ENVIRONMENT_LABELS, type FeatureFlag, type FlagAction } from "./types";

export interface FlagCommand {
  action: FlagAction;
  actor: string;
  actorName?: string | null;
  actorRole?: string | null;
  /** Required for `set_rollout`, ignored otherwise. */
  rolloutPercentage?: number;
  reason?: string | null;
  /** The flag key, retyped by the operator (case-insensitive). Required in production. */
  confirmation?: string | null;
  occurredAt?: Date;
  eventId?: string;
}

export interface FlagResult {
  flag: FeatureFlag;
  event: AuditEvent;
}

export class FlagError extends Error {}

/** Maps a flag action onto the platform-wide audit action code. */
export const FLAG_AUDIT_ACTIONS: Record<FlagAction, AuditAction> = {
  enable: "FLAG_ENABLED",
  disable: "FLAG_DISABLED",
  set_rollout: "ROLLOUT_CHANGED",
};

export function isValidRollout(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

/**
 * Guardrail: every production change must be justified, whatever it changes.
 */
export function requiresReasonForChange(flag: FeatureFlag): boolean {
  return flag.environment === "production";
}

/**
 * Guardrail: a production change also has to be typed out — the operator
 * retypes the flag key, so the dialog cannot be cleared by muscle memory.
 */
export function requiresTypedConfirmation(flag: FeatureFlag): boolean {
  return flag.environment === "production";
}

/** Every change is confirmed before it is submitted, in any environment. */
export function requiresConfirmation(): boolean {
  return true;
}

/**
 * Pure state transition mirroring the KYC review layer: validate, return the
 * next flag plus the audit event that records the change. Never mutates input.
 */
export function applyFlagChange(flag: FeatureFlag, command: FlagCommand): FlagResult {
  const { action, actor } = command;
  const reason = command.reason?.trim() ? command.reason.trim() : null;

  if (!actor.trim()) {
    throw new FlagError("An actor is required to change a feature flag.");
  }

  let next: FeatureFlag;
  let changedField: string;
  let previousValue: string;
  let newValue: string;

  if (action === "enable" || action === "disable") {
    const enabled = action === "enable";
    if (flag.enabled === enabled) {
      throw new FlagError(
        `Flag ${flag.key} is already ${enabled ? "enabled" : "disabled"} in ${
          ENVIRONMENT_LABELS[flag.environment]
        }.`,
      );
    }
    next = { ...flag, enabled };
    changedField = "Enabled";
    previousValue = flag.enabled ? "On" : "Off";
    newValue = enabled ? "On" : "Off";
  } else {
    const rollout = command.rolloutPercentage;
    if (rollout === undefined) {
      throw new FlagError("A rollout percentage is required.");
    }
    if (!isValidRollout(rollout)) {
      throw new FlagError("Rollout percentage must be a whole number between 0 and 100.");
    }
    if (rollout === flag.rolloutPercentage) {
      throw new FlagError(`Flag ${flag.key} is already at ${rollout}% rollout.`);
    }
    next = { ...flag, rolloutPercentage: rollout };
    changedField = "Rollout";
    previousValue = `${flag.rolloutPercentage}%`;
    newValue = `${rollout}%`;
  }

  if (requiresReasonForChange(flag) && !reason) {
    throw new FlagError(
      `A reason is required to change ${flag.key} in ${ENVIRONMENT_LABELS[flag.environment]}.`,
    );
  }

  if (
    requiresTypedConfirmation(flag) &&
    command.confirmation?.trim().toLowerCase() !== flag.key.toLowerCase()
  ) {
    throw new FlagError(
      `Type the flag key “${flag.key}” to confirm this ${
        ENVIRONMENT_LABELS[flag.environment]
      } change.`,
    );
  }

  const occurredAt = command.occurredAt ?? new Date();
  next = { ...next, updatedAt: occurredAt.toISOString() };

  const event = buildAuditEvent({
    id: command.eventId,
    action: FLAG_AUDIT_ACTIONS[action],
    resourceType: "feature_flag",
    resourceId: flag.id,
    resourceLabel: `${flag.name} (${ENVIRONMENT_LABELS[flag.environment]})`,
    actor: actor.trim(),
    actorName: command.actorName ?? null,
    actorRole: command.actorRole ?? null,
    changedField,
    previousValue,
    newValue,
    reason,
    occurredAt,
  });

  return { flag: next, event };
}
