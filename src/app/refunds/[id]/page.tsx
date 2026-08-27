import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { RiskBadge } from "@/components/kyc/StatusBadges";
import { RefundDecisionActions } from "@/components/refunds/RefundDecisionActions";
import { HighValueBadge, RefundStatusBadge } from "@/components/refunds/StatusBadges";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { Card, DescriptionList } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatMoney, formatTenure } from "@/lib/format";
import { decisionBlockedMessage } from "@/lib/refunds/policy";
import { getRefund, listRefundAuditEvents } from "@/lib/refunds/store";
import {
  isTerminalRefund,
  PAYMENT_METHOD_LABELS,
  REFUND_REASON_LABELS,
  REFUND_STATUS_LABELS,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/refunds/types";

export const dynamic = "force-dynamic";

export default function RefundDetailPage({ params }: { params: { id: string } }) {
  const refund = getRefund(params.id);
  if (!refund) notFound();

  const user = getCurrentUser();
  if (!can(user.role, "refunds:view")) {
    return <AccessDenied role={user.role} permission="refunds:view" />;
  }

  const events = listRefundAuditEvents(refund.id);
  const closed = isTerminalRefund(refund.status);
  const approveBlocked = decisionBlockedMessage(
    user.role,
    "approve",
    refund.requestedAmountCents,
  );
  const denyBlocked = decisionBlockedMessage(user.role, "deny", refund.requestedAmountCents);
  const partial = refund.requestedAmountCents < refund.originalAmountCents;

  return (
    <>
      <PageHeader
        title={`${formatMoney(refund.requestedAmountCents)} refund`}
        description={`${refund.customerName} · ${refund.merchant} · requested ${formatDateTime(
          refund.requestedAt,
        )}`}
        crumbs={[
          { label: "Operations" },
          { label: "Refund Operations", href: "/refunds" },
          { label: refund.id },
        ]}
        meta={
          <>
            <RiskBadge risk={refund.riskLevel} />
            <RefundStatusBadge status={refund.status} />
            <HighValueBadge amountCents={refund.requestedAmountCents} />
            <span className="font-mono text-xs text-faint">{refund.id}</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Refund request">
            <DescriptionList
              items={[
                {
                  label: "Requested amount",
                  value: (
                    <span className="font-mono text-fg">
                      {formatMoney(refund.requestedAmountCents)}
                      {partial ? (
                        <span className="ml-2 text-xs text-faint">
                          partial of {formatMoney(refund.originalAmountCents)}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                { label: "Reason", value: REFUND_REASON_LABELS[refund.reason] },
                { label: "Requested", value: formatDateTime(refund.requestedAt) },
                { label: "Status", value: REFUND_STATUS_LABELS[refund.status] },
              ]}
            />
            <p className="mt-4 rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-muted">
              “{refund.customerNote}”
            </p>
          </Card>

          <Card title="Transaction">
            <DescriptionList
              items={[
                { label: "Merchant", value: refund.merchant },
                {
                  label: "Transaction",
                  value: <span className="font-mono text-xs">{refund.transactionId}</span>,
                },
                { label: "Transaction date", value: formatDateTime(refund.transactionDate) },
                {
                  label: "Original amount",
                  value: (
                    <span className="font-mono">{formatMoney(refund.originalAmountCents)}</span>
                  ),
                },
                { label: "Payment method", value: PAYMENT_METHOD_LABELS[refund.paymentMethod] },
                {
                  label: "Transaction status",
                  value: TRANSACTION_STATUS_LABELS[refund.transactionStatus],
                },
              ]}
            />
          </Card>

          <Card title="Customer">
            <DescriptionList
              items={[
                { label: "Name", value: refund.customerName },
                {
                  label: "Account",
                  value: <span className="font-mono text-xs">{refund.customerId}</span>,
                },
                { label: "Customer since", value: formatDate(refund.customerSince) },
                { label: "Account tenure", value: formatTenure(refund.customerSince) },
              ]}
            />
          </Card>

          <Card title="Risk signals" description="Raised by automated screening.">
            {refund.signals.length === 0 ? (
              <p className="text-sm text-faint">No signals raised for this request.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {refund.signals.map((signal) => (
                  <li
                    key={signal}
                    className="rounded-lg border border-[rgba(251,191,36,0.24)] bg-[var(--warning-soft)] px-2.5 py-1.5 text-xs text-warning"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Refund decision">
            <RefundDecisionActions
              refundId={refund.id}
              customerName={refund.customerName}
              merchant={refund.merchant}
              transactionId={refund.transactionId}
              amount={formatMoney(refund.requestedAmountCents)}
              statusLabel={REFUND_STATUS_LABELS[refund.status]}
              disabledMessage={
                closed
                  ? `This refund was ${refund.status}${
                      refund.reviewer ? ` by ${refund.reviewer}` : ""
                    }${
                      refund.decidedAt ? ` on ${formatDateTime(refund.decidedAt)}` : ""
                    } and is immutable.${
                      refund.decisionReason ? ` Reason: ${refund.decisionReason}` : ""
                    }`
                  : undefined
              }
              approveBlockedMessage={approveBlocked ?? undefined}
              denyBlockedMessage={denyBlocked ?? undefined}
            />
          </Card>

          <Card
            title="History"
            description="Append-only record from the shared platform audit log."
          >
            <AuditTimeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}
