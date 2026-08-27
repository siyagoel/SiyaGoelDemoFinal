"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { ConfirmDialog, type DialogTone } from "@/components/ui/Dialog";
import { Label, TextArea } from "@/components/ui/Field";
import { useActionToast } from "@/components/ui/Toast";
import {
  IconCheck,
  IconEscalate,
  IconLock,
  IconX,
} from "@/components/ui/icons";
import { submitReviewAction, type ReviewActionState } from "@/lib/kyc/actions";
import type { ReviewAction } from "@/lib/kyc/types";

const INITIAL_STATE: ReviewActionState = { ok: false, error: null };

const ACTION_VARIANTS: Record<ReviewAction, ButtonVariant> = {
  approve: "success",
  reject: "danger",
  escalate: "secondary",
};

const ACTION_ICONS: Record<ReviewAction, JSX.Element> = {
  approve: <IconCheck />,
  reject: <IconX />,
  escalate: <IconEscalate />,
};

const ACTION_LABELS: Record<ReviewAction, string> = {
  approve: "Approve",
  reject: "Reject",
  escalate: "Escalate",
};

const CONFIRM_TITLES: Record<ReviewAction, string> = {
  approve: "Approve KYC case",
  reject: "Reject KYC case",
  escalate: "Escalate KYC case",
};

const DIALOG_TONES: Record<ReviewAction, DialogTone> = {
  approve: "neutral",
  reject: "danger",
  escalate: "warning",
};

const SENSITIVITY: Record<ReviewAction, string> = {
  approve: "Approving is final — the case cannot be reopened afterwards.",
  reject:
    "Rejecting is final and visible to the applicant. It cannot be undone.",
  escalate:
    "Escalating hands the decision to another reviewer; you will not be able to decide this case.",
};

const SUCCESS_MESSAGES: Record<ReviewAction, string> = {
  approve: "Case approved and recorded in the audit log.",
  reject: "Case rejected and recorded in the audit log.",
  escalate: "Case escalated — another reviewer must now decide.",
};

function Notice({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  const classes =
    tone === "danger"
      ? "border-[rgba(248,113,113,0.24)] bg-[var(--danger-soft)] text-danger"
      : "border-[rgba(251,191,36,0.24)] bg-[var(--warning-soft)] text-warning";
  return (
    <p className={`rounded-lg border px-3 py-2 text-xs ${classes}`}>
      {children}
    </p>
  );
}

function ConfirmButton({ action }: { action: ReviewAction }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="action"
      value={action}
      disabled={pending}
      variant={ACTION_VARIANTS[action]}
    >
      {pending ? "Saving…" : `Confirm ${ACTION_LABELS[action].toLowerCase()}`}
    </Button>
  );
}

export function ReviewActions({
  applicationId,
  applicantName,
  canDecide,
  permissionMessage,
  disabled,
  disabledMessage,
  canEscalate,
  canApprove,
  canReject,
  decisionBlockedMessage,
  approvalBlockedMessage,
  noteRequiredToApprove,
}: {
  applicationId: string;
  applicantName: string;
  canDecide: boolean;
  permissionMessage: string;
  disabled: boolean;
  disabledMessage?: string;
  canEscalate: boolean;
  canApprove: boolean;
  canReject: boolean;
  /** Why both final decisions are unavailable, e.g. separation of duties. */
  decisionBlockedMessage?: string;
  approvalBlockedMessage?: string;
  noteRequiredToApprove: boolean;
}) {
  const [state, formAction] = useFormState(submitReviewAction, INITIAL_STATE);
  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const submitted = useRef<ReviewAction | null>(null);

  useActionToast(state, () =>
    submitted.current ? SUCCESS_MESSAGES[submitted.current] : "Case updated.",
  );

  const cancel = useCallback(() => {
    setPending(null);
    setLocalError(null);
  }, []);

  useEffect(() => {
    if (!state.ok) return;
    setPending(null);
    setReason("");
  }, [state.ok]);

  if (!canDecide) {
    return (
      <div className="flex items-start gap-2">
        <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p className="text-xs text-muted">{permissionMessage}</p>
      </div>
    );
  }

  if (disabled) {
    return (
      <p className="text-xs text-faint">
        {disabledMessage ??
          "This application is closed; no further actions are available."}
      </p>
    );
  }

  const reasonRequired =
    pending === "reject" || pending === "escalate" || noteRequiredToApprove;

  const dialog = pending ? (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (reasonRequired && !reason.trim()) {
          event.preventDefault();
          setLocalError(
            "A reason is required before this action can be submitted.",
          );
          return;
        }
        submitted.current = pending;
      }}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <ConfirmDialog
        title={CONFIRM_TITLES[pending]}
        tone={DIALOG_TONES[pending]}
        sensitivity={SENSITIVITY[pending]}
        resource={`${applicantName} · ${applicationId}`}
        onCancel={cancel}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <ConfirmButton action={pending} />
          </>
        }
      >
        <div>
          <Label htmlFor="reason">
            {reasonRequired ? "Reason (required)" : "Reason (optional)"}
          </Label>
          <TextArea
            id="reason"
            name="reason"
            rows={3}
            required={reasonRequired}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setLocalError(null);
            }}
            placeholder="Identity document could not be verified, sanctions hit confirmed, …"
          />
        </div>
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
    <div className="space-y-3">
      {dialog}
      {canApprove && canReject ? null : (
        <Notice>
          {decisionBlockedMessage ??
            approvalBlockedMessage ??
            "High-risk cases must be escalated, with a reviewer note, before they can be approved."}
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        {(["approve", "reject", "escalate"] as const)
          .filter((action) =>
            action === "approve"
              ? canApprove
              : action === "reject"
                ? canReject
                : canEscalate,
          )
          .map((action) => (
            <Button
              key={action}
              type="button"
              variant={ACTION_VARIANTS[action]}
              icon={ACTION_ICONS[action]}
              onClick={() => setPending(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
      </div>
      <p className="text-2xs text-faint">
        Rejecting or escalating opens a confirmation dialog and requires a
        reason.
      </p>
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
