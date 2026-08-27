import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  RISK_LABELS,
  STATUS_LABELS,
  type ReviewStatus,
  type RiskLevel,
} from "@/lib/kyc/types";

const STATUS_TONES: Record<ReviewStatus, BadgeTone> = {
  pending: "neutral",
  escalated: "warning",
  approved: "success",
  rejected: "danger",
};

const RISK_TONES: Record<RiskLevel, BadgeTone> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function RiskBadge({ risk, score }: { risk: RiskLevel; score?: number }) {
  return (
    <Badge tone={RISK_TONES[risk]}>
      {RISK_LABELS[risk]}
      {typeof score === "number" ? ` · ${score}` : ""}
    </Badge>
  );
}
