import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { HIGH_VALUE_REFUND_THRESHOLD_CENTS, isHighValueRefund } from "@/lib/refunds/policy";
import { formatMoney } from "@/lib/format";
import { REFUND_STATUS_LABELS, type RefundStatus } from "@/lib/refunds/types";

const STATUS_TONES: Record<RefundStatus, BadgeTone> = {
  pending: "neutral",
  approved: "success",
  denied: "danger",
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{REFUND_STATUS_LABELS[status]}</Badge>;
}

/** Marks requests that need elevated authorization, nothing else. */
export function HighValueBadge({ amountCents }: { amountCents: number }) {
  if (!isHighValueRefund(amountCents)) return null;
  return (
    <Badge tone="warning">
      High value · {formatMoney(HIGH_VALUE_REFUND_THRESHOLD_CENTS)}+
    </Badge>
  );
}
