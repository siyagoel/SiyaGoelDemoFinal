"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { ChangePreview, ConfirmDialog, type DialogTone } from "@/components/ui/Dialog";
import { Label, TextArea } from "@/components/ui/Field";
import { useActionToast } from "@/components/ui/Toast";
import { IconCheck, IconLock, IconX } from "@/components/ui/icons";
import { submitRefundDecision, type RefundActionState } from "@/lib/refunds/actions";
import type { RefundDecision } from "@/lib/refunds/types";

const INITIAL_STATE: RefundActionState = { ok: false, error: null };

const VARIANTS: Record<RefundDecision, ButtonVariant> = {
  approve: "success",
  deny: "danger",
};

const ICONS: Record<RefundDecision, JSX.Element> = {
  approve: <IconCheck />,
  deny: <IconX />,
};

const LABELS: Record<RefundDecision, string> = {
  approve: "Approve refund",
  deny: "Deny refund",
};

const TITLES: Record<RefundDecision, string> = {
  approve: "Approve refund",
  deny: "Deny refund",
};

const TONES: Record<RefundDecision, DialogTone> = {
  approve: "neutral",
  deny: "danger",
};

const SENSITIVITY: Record<RefundDecision, string> = {
  approve: "Approving releases the funds to the customer and cannot be reversed.",
  deny: "Denying is final and is communicated to the customer.",
};

const SUCCESS_MESSAGES: Record<RefundDecision, string> = {
  approve: "Refund approved and recorded in the audit log.",
  deny: "Refund denied and recorded in the audit log.",
};

function ConfirmButton({ decision }: { decision: RefundDecision }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      variant={VARIANTS[decision]}
    >
      {pending ? "Saving…" : `Confirm ${decision === "approve" ? "approval" : "denial"}`}
    </Button>
  );
}

export function RefundDecisionActions({
  refundId,
  customerName,
  merchant,
  transactionId,
  amount,
  statusLabel,
  disabledMessage,
  approveBlockedMessage,
  denyBlockedMessage,
}: {
  refundId: string;
  customerName: string;
  merchant: string;
  transactionId: string;
  /** Preformatted refund amount, so money is rendered the same everywhere. */
  amount: string;
  statusLabel: string;
  /** Set when the request is already decided; no action is possible. */
  disabledMessage?: string;
  /** Why approval is unavailable to this role, when it is. */
  approveBlockedMessage?: string;
  denyBlockedMessage?: string;
}) {
  const [state, formAction] = useFormState(submitRefundDecision, INITIAL_STATE);
  const [pending, setPending] = useState<RefundDecision | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const submitted = useRef<RefundDecision | null>(null);

  useActionToast(state, () =>
    submitted.current ? SUCCESS_MESSAGES[submitted.current] : "Refund updated.",
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

  if (disabledMessage) {
    return <p className="text-xs text-faint">{disabledMessage}</p>;
  }

  if (approveBlockedMessage && denyBlockedMessage) {
    return (
      <div className="flex items-start gap-2">
        <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p className="text-xs text-muted">{denyBlockedMessage}</p>
      </div>
    );
  }

  const reasonRequired = pending === "deny";

  const dialog = pending ? (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (reasonRequired && !reason.trim()) {
          event.preventDefault();
          setLocalError("A reason is required before a refund can be denied.");
          return;
        }
        submitted.current = pending;
      }}
    >
      <input type="hidden" name="refundId" value={refundId} />
      <ConfirmDialog
        title={TITLES[pending]}
        tone={TONES[pending]}
        sensitivity={SENSITIVITY[pending]}
        resource={`${customerName} · ${refundId}`}
        onCancel={cancel}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <ConfirmButton decision={pending} />
          </>
        }
      >
        <dl className="overflow-hidden rounded-lg border border-line text-xs">
          {[
            { label: "Customer", value: customerName },
            { label: "Transaction", value: `${merchant} · ${transactionId}` },
            { label: "Refund amount", value: amount },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[7rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-b-0"
            >
              <dt className="text-2xs uppercase tracking-wider text-faint">{row.label}</dt>
              <dd className="font-medium text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>
        <ChangePreview
          rows={[
            {
              label: "Status",
              current: statusLabel,
              proposed: pending === "approve" ? "Approved" : "Denied",
            },
          ]}
        />
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
            placeholder="Merchant confirmed delivery, duplicate charge not found, …"
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
      {approveBlockedMessage ? (
        <p className="flex items-start gap-2 rounded-lg border border-[rgba(251,191,36,0.24)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-warning">
          <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{approveBlockedMessage}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(["approve", "deny"] as const)
          .filter((decision) =>
            decision === "approve" ? !approveBlockedMessage : !denyBlockedMessage,
          )
          .map((decision) => (
            <Button
              key={decision}
              type="button"
              variant={VARIANTS[decision]}
              icon={ICONS[decision]}
              onClick={() => setPending(decision)}
            >
              {LABELS[decision]}
            </Button>
          ))}
      </div>
      <p className="text-2xs text-faint">
        Both decisions open a confirmation dialog; denying requires a reason.
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
