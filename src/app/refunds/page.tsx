import Link from "next/link";
import { Suspense } from "react";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { RiskBadge } from "@/components/kyc/StatusBadges";
import { RefundFilters } from "@/components/refunds/RefundFilters";
import { HighValueBadge, RefundStatusBadge } from "@/components/refunds/StatusBadges";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { can } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { RISK_LEVELS, type RiskLevel } from "@/lib/kyc/types";
import { refundSummary } from "@/lib/metrics";
import { HIGH_VALUE_REFUND_THRESHOLD_CENTS } from "@/lib/refunds/policy";
import { listRefundAuditEvents, listRefunds, type RefundValueFilter } from "@/lib/refunds/store";
import {
  isRefundStatus,
  REFUND_REASON_LABELS,
  REFUND_WINDOWS,
  type RefundRequest,
  type RefundStatus,
} from "@/lib/refunds/types";

export const dynamic = "force-dynamic";

const COLUMNS: Column<RefundRequest>[] = [
  {
    key: "customer",
    header: "Customer",
    render: (refund) => (
      <div className="min-w-0">
        <Link
          href={`/refunds/${refund.id}`}
          className="font-medium text-fg transition-colors hover:text-accent"
        >
          {refund.customerName}
        </Link>
        <p className="truncate text-xs text-faint">{refund.customerId}</p>
      </div>
    ),
  },
  {
    key: "id",
    header: "Request",
    render: (refund) => <span className="font-mono text-xs text-muted">{refund.id}</span>,
  },
  {
    key: "merchant",
    header: "Merchant",
    render: (refund) => (
      <div className="min-w-0">
        <p className="truncate text-muted">{refund.merchant}</p>
        <p className="truncate font-mono text-2xs text-faint">{refund.transactionId}</p>
      </div>
    ),
  },
  {
    key: "reason",
    header: "Reason",
    render: (refund) => (
      <span className="text-xs text-muted">{REFUND_REASON_LABELS[refund.reason]}</span>
    ),
  },
  {
    key: "risk",
    header: "Risk",
    render: (refund) => <RiskBadge risk={refund.riskLevel} />,
  },
  {
    key: "status",
    header: "Status",
    render: (refund) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <RefundStatusBadge status={refund.status} />
        {refund.status === "pending" ? (
          <HighValueBadge amountCents={refund.requestedAmountCents} />
        ) : null}
      </div>
    ),
  },
  {
    key: "original",
    header: "Original",
    align: "right",
    render: (refund) => (
      <span className="font-mono text-xs text-faint">
        {formatMoney(refund.originalAmountCents)}
      </span>
    ),
  },
  {
    key: "requested",
    header: "Refund",
    align: "right",
    render: (refund) => (
      <span className="font-mono text-sm font-medium text-fg">
        {formatMoney(refund.requestedAmountCents)}
      </span>
    ),
  },
  {
    key: "requestedAt",
    header: "Requested",
    align: "right",
    render: (refund) => (
      <span className="text-xs text-faint">{formatDateTime(refund.requestedAt)}</span>
    ),
  },
];

function asStatus(value?: string): RefundStatus | "all" {
  return isRefundStatus(value) ? value : "all";
}

function asRisk(value?: string): RiskLevel | "all" {
  return RISK_LEVELS.includes(value as RiskLevel) ? (value as RiskLevel) : "all";
}

function asValue(value?: string): RefundValueFilter {
  return value === "high_value" || value === "standard" ? value : "all";
}

function asWindowDays(value?: string): number | undefined {
  return REFUND_WINDOWS.find((window) => window.value === value)?.days;
}

export default function RefundQueuePage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; risk?: string; value?: string; window?: string };
}) {
  const user = getCurrentUser();
  if (!can(user.role, "refunds:view")) {
    return <AccessDenied role={user.role} permission="refunds:view" />;
  }

  const all = listRefunds();
  const summary = refundSummary(all);
  const refunds = listRefunds({
    search: searchParams.q,
    status: asStatus(searchParams.status),
    risk: asRisk(searchParams.risk),
    value: asValue(searchParams.value),
    withinDays: asWindowDays(searchParams.window),
  });
  const recentEvents = listRefundAuditEvents().slice(0, 5);

  return (
    <>
      <PageHeader
        title="Refund Operations"
        description="Review customer refund requests, approve releases of funds and record denials."
        crumbs={[{ label: "Operations" }, { label: "Refund Operations" }]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          id="refunds-pending"
          label="Awaiting decision"
          value={summary.pending}
          hint={`${all.length} requests in total`}
          href="/refunds?status=pending"
        />
        <Stat
          id="refunds-pending-value"
          label="Value awaiting decision"
          value={formatMoney(summary.pendingValueCents)}
        />
        <Stat
          id="refunds-high-value"
          label="High value pending"
          value={summary.highValuePending}
          tone="warning"
          hint={`${formatMoney(HIGH_VALUE_REFUND_THRESHOLD_CENTS)}+ · Admin decision`}
          href="/refunds?status=pending&value=high_value"
        />
        <Stat
          id="refunds-approval-rate"
          label="Approval rate"
          value={summary.approvalRate === null ? "—" : `${summary.approvalRate}%`}
          hint={`${summary.approved} approved · ${summary.denied} denied`}
        />
      </div>

      <Suspense fallback={null}>
        <RefundFilters />
      </Suspense>

      <p className="mb-2 text-xs text-faint">
        Showing {refunds.length} of {all.length} refund requests
      </p>

      <DataTable
        columns={COLUMNS}
        rows={refunds}
        rowKey={(refund) => refund.id}
        emptyMessage="No refund requests match the current filters."
      />

      <div className="mt-6">
        <Card
          title="Recent refund activity"
          description="Decisions recorded in the shared platform audit log."
        >
          <AuditTimeline events={recentEvents} showResource />
        </Card>
      </div>
    </>
  );
}
