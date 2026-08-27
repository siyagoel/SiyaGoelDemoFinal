"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  ChangePreview,
  ConfirmDialog,
  type DialogTone,
} from "@/components/ui/Dialog";
import { Label, TextArea, TextInput } from "@/components/ui/Field";
import { useActionToast } from "@/components/ui/Toast";
import { Meter } from "@/components/ui/Charts";
import { IconLock } from "@/components/ui/icons";
import { submitFlagChange, type FlagActionState } from "@/lib/flags/actions";
import {
  requiresReasonForChange,
  requiresTypedConfirmation,
} from "@/lib/flags/mutations";
import {
  ENVIRONMENT_LABELS,
  type FeatureFlag,
  type FlagAction,
} from "@/lib/flags/types";

const INITIAL_STATE: FlagActionState = { ok: false, error: null };

interface PendingChange {
  action: FlagAction;
  title: string;
  summary: string;
  currentValue: string;
  proposedValue: string;
  reasonRequired: boolean;
  rolloutPercentage?: number;
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Applying…" : "Confirm change"}
    </Button>
  );
}

function DescriptionRow({
  flag,
  environment,
}: {
  flag: FeatureFlag;
  environment: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <span
          className={`h-1.5 w-1.5 rounded-full ${flag.enabled ? "bg-success" : "bg-faint"}`}
        />
        {flag.enabled ? "Enabled" : "Disabled"}
      </p>
      <p className="mt-0.5 text-xs text-faint">
        {flag.rolloutPercentage}% rollout · applies to {environment}
      </p>
    </div>
  );
}

export function FlagControls({
  flag,
  canManage,
  permissionMessage,
}: {
  flag: FeatureFlag;
  canManage: boolean;
  permissionMessage: string;
}) {
  const [state, formAction] = useFormState(submitFlagChange, INITIAL_STATE);
  const [rollout, setRollout] = useState(String(flag.rolloutPercentage));
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useActionToast(
    state,
    () => `${flag.name} updated in ${ENVIRONMENT_LABELS[flag.environment]}.`,
  );

  const cancel = useCallback(() => {
    setPending(null);
    setConfirmation("");
    setLocalError(null);
  }, []);

  useEffect(() => {
    if (!state.ok) return;
    setPending(null);
    setReason("");
    setConfirmation("");
  }, [state.ok]);

  useEffect(() => {
    setRollout(String(flag.rolloutPercentage));
  }, [flag.rolloutPercentage, flag.id]);

  const environment = ENVIRONMENT_LABELS[flag.environment];

  if (!canManage) {
    return (
      <div className="space-y-3">
        <DescriptionRow flag={flag} environment={environment} />
        <Meter value={flag.enabled ? flag.rolloutPercentage : 0} />
        <div className="flex items-start gap-2">
          <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-xs text-muted">{permissionMessage}</p>
        </div>
      </div>
    );
  }

  function requestToggle() {
    const action: FlagAction = flag.enabled ? "disable" : "enable";
    setLocalError(null);
    setConfirmation("");
    setPending({
      action,
      title: `${flag.enabled ? "Disable" : "Enable"} ${flag.key} in ${environment}`,
      summary: `You are ${flag.enabled ? "disabling" : "enabling"} “${
        flag.name
      }” in ${environment}. Confirm this change?`,
      currentValue: flag.enabled ? "Enabled" : "Disabled",
      proposedValue: flag.enabled ? "Disabled" : "Enabled",
      reasonRequired: requiresReasonForChange(flag),
    });
  }

  function requestRollout() {
    const value = Number(rollout);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setLocalError(
        "Rollout percentage must be a whole number between 0 and 100.",
      );
      return;
    }
    if (value === flag.rolloutPercentage) {
      setLocalError(`Rollout is already ${value}%.`);
      return;
    }
    setLocalError(null);
    setConfirmation("");
    setPending({
      action: "set_rollout",
      rolloutPercentage: value,
      title:
        value === 100 && flag.environment === "production"
          ? `Increase ${environment} rollout to 100%`
          : `Change ${flag.key} rollout in ${environment}`,
      summary: `You are changing “${flag.name}” in ${environment} from ${flag.rolloutPercentage}% rollout to ${value}%. Confirm this change?`,
      currentValue: `${flag.rolloutPercentage}% rollout`,
      proposedValue: `${value}% rollout`,
      reasonRequired: requiresReasonForChange(flag),
    });
  }

  const isProduction = flag.environment === "production";
  const confirmationRequired = requiresTypedConfirmation(flag);
  const tone: DialogTone = isProduction ? "warning" : "neutral";

  const dialog = pending ? (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (pending.reasonRequired && !reason.trim()) {
          event.preventDefault();
          setLocalError(
            "A reason is required before this change can be submitted.",
          );
          return;
        }
        if (
          confirmationRequired &&
          confirmation.trim().toLowerCase() !== flag.key.toLowerCase()
        ) {
          event.preventDefault();
          setLocalError(`Type “${flag.key}” to confirm this change.`);
        }
      }}
    >
      <input type="hidden" name="flagId" value={flag.id} />
      <input type="hidden" name="action" value={pending.action} />
      {pending.rolloutPercentage !== undefined ? (
        <input
          type="hidden"
          name="rolloutPercentage"
          value={pending.rolloutPercentage}
        />
      ) : null}
      <ConfirmDialog
        title={pending.title}
        tone={tone}
        resource={`${flag.name} · ${flag.key} · ${environment}`}
        sensitivity={
          isProduction
            ? "This change takes effect in Production immediately and is recorded in the audit log. Every production change needs a reason and the flag key typed out."
            : undefined
        }
        onCancel={cancel}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <ConfirmButton />
          </>
        }
      >
        <p className="text-xs text-muted">{pending.summary}</p>
        <ChangePreview
          rows={[
            {
              label: pending.action === "set_rollout" ? "Rollout" : "State",
              current: pending.currentValue,
              proposed: pending.proposedValue,
            },
          ]}
        />
        <div>
          <Label htmlFor="reason">
            {pending.reasonRequired ? "Reason (required)" : "Reason (optional)"}
          </Label>
          <TextArea
            id="reason"
            name="reason"
            rows={2}
            required={pending.reasonRequired}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setLocalError(null);
            }}
            placeholder="Ramping up after load test, incident mitigation, …"
          />
        </div>
        {confirmationRequired ? (
          <div>
            <Label htmlFor="confirmation">
              Type <span className="font-mono text-fg">{flag.key}</span> to
              confirm
            </Label>
            <TextInput
              id="confirmation"
              name="confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setLocalError(null);
              }}
              placeholder={flag.key}
            />
          </div>
        ) : null}
        {(localError ?? state.error) ? (
          <p
            role="alert"
            className="rounded-lg border border-[rgba(248,113,113,0.24)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-danger"
          >
            {localError ?? state.error}
          </p>
        ) : null}
      </ConfirmDialog>
    </form>
  ) : null;

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex items-center justify-between gap-3">
        <DescriptionRow flag={flag} environment={environment} />
        <Button
          type="button"
          onClick={requestToggle}
          variant={flag.enabled ? "danger" : "success"}
        >
          {flag.enabled ? "Disable flag" : "Enable flag"}
        </Button>
      </div>

      <Meter
        value={flag.enabled ? flag.rolloutPercentage : 0}
        tone={flag.rolloutPercentage === 100 ? "warning" : "accent"}
      />

      <div>
        <Label htmlFor="rolloutPercentage">Rollout percentage</Label>
        <div className="flex items-center gap-2">
          <TextInput
            id="rolloutPercentage"
            type="number"
            min={0}
            max={100}
            step={1}
            value={rollout}
            onChange={(event) => setRollout(event.target.value)}
            className="w-24"
          />
          <Button type="button" onClick={requestRollout}>
            Update rollout
          </Button>
        </div>
      </div>

      {localError && !pending ? (
        <p
          role="alert"
          className="rounded-lg border border-[rgba(248,113,113,0.24)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-danger"
        >
          {localError}
        </p>
      ) : null}
      {state.error && !pending ? (
        <p
          role="alert"
          className="rounded-lg border border-[rgba(248,113,113,0.24)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-danger"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
