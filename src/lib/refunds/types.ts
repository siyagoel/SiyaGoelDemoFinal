import type { RiskLevel } from "@/lib/kyc/types";

/** Risk vocabulary is shared platform-wide, so refunds reuse the KYC levels. */
export type { RiskLevel };

export type RefundStatus = "pending" | "approved" | "denied";

export type RefundDecision = "approve" | "deny";

export type RefundReason =
  | "item_not_received"
  | "duplicate_charge"
  | "unauthorized_transaction"
  | "service_cancelled"
  | "product_defective"
  | "billing_error";

export type PaymentMethod =
  | "visa_credit"
  | "mastercard_debit"
  | "ach_transfer"
  | "virtual_card"
  | "apple_pay";

export type TransactionStatus = "settled" | "pending" | "disputed";

export interface RefundRequest {
  id: string;
  customerName: string;
  customerId: string;
  /** ISO date the customer account was opened; drives account tenure. */
  customerSince: string;
  merchant: string;
  transactionId: string;
  transactionDate: string;
  transactionStatus: TransactionStatus;
  paymentMethod: PaymentMethod;
  /** Money is held in minor units so no rounding happens in the UI. */
  originalAmountCents: number;
  requestedAmountCents: number;
  reason: RefundReason;
  customerNote: string;
  requestedAt: string;
  riskLevel: RiskLevel;
  /** Contextual signals raised by fraud screening. */
  signals: string[];
  status: RefundStatus;
  /** Operator who decided the request, once decided. */
  reviewer: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}

export const REFUND_STATUSES: RefundStatus[] = ["pending", "approved", "denied"];

export const TERMINAL_REFUND_STATUSES: RefundStatus[] = ["approved", "denied"];

/** Date windows offered by the queue filter, shared by the server page and the client control. */
export const REFUND_WINDOWS: { value: string; label: string; days: number }[] = [
  { value: "1d", label: "Last 24 hours", days: 1 },
  { value: "3d", label: "Last 3 days", days: 3 },
  { value: "7d", label: "Last 7 days", days: 7 },
];

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  item_not_received: "Item not received",
  duplicate_charge: "Duplicate charge",
  unauthorized_transaction: "Unauthorised transaction",
  service_cancelled: "Service cancelled",
  product_defective: "Product defective",
  billing_error: "Billing error",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  visa_credit: "Visa credit",
  mastercard_debit: "Mastercard debit",
  ach_transfer: "ACH transfer",
  virtual_card: "Virtual card",
  apple_pay: "Apple Pay",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  settled: "Settled",
  pending: "Pending settlement",
  disputed: "Disputed",
};

export const REFUND_DECISION_LABELS: Record<RefundDecision, string> = {
  approve: "Approve",
  deny: "Deny",
};

export function isTerminalRefund(status: RefundStatus): boolean {
  return TERMINAL_REFUND_STATUSES.includes(status);
}

export function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === "string" && (REFUND_STATUSES as string[]).includes(value);
}
