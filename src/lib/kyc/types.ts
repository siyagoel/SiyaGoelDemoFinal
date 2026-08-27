export type RiskLevel = "low" | "medium" | "high";

export type ReviewStatus = "pending" | "escalated" | "approved" | "rejected";

export type ReviewAction = "approve" | "reject" | "escalate";

export interface KycDocument {
  type: "passport" | "drivers_license" | "national_id" | "proof_of_address";
  reference: string;
  uploadedAt: string;
}

export interface KycApplication {
  id: string;
  fullName: string;
  email: string;
  country: string;
  dateOfBirth: string;
  submittedAt: string;
  riskLevel: RiskLevel;
  riskScore: number;
  status: ReviewStatus;
  flags: string[];
  documents: KycDocument[];
  decidedAt: string | null;
  decisionReason: string | null;
}

export const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];

export const REVIEW_STATUSES: ReviewStatus[] = [
  "pending",
  "escalated",
  "approved",
  "rejected",
];

export const TERMINAL_STATUSES: ReviewStatus[] = ["approved", "rejected"];

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
