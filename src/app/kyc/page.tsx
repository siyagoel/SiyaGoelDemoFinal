import Link from "next/link";
import { Suspense } from "react";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { QueueFilters } from "@/components/kyc/QueueFilters";
import { RiskBadge, StatusBadge } from "@/components/kyc/StatusBadges";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { can } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { listApplications, listAuditEvents, queueSummary } from "@/lib/kyc/store";
import {
  REVIEW_STATUSES,
  RISK_LEVELS,
  type KycApplication,
  type ReviewStatus,
  type RiskLevel,
} from "@/lib/kyc/types";

export const dynamic = "force-dynamic";

const COLUMNS: Column<KycApplication>[] = [
  {
    key: "applicant",
    header: "Applicant",
    render: (application) => (
      <div className="min-w-0">
        <Link
          href={`/kyc/${application.id}`}
          className="font-medium text-fg transition-colors hover:text-accent"
        >
          {application.fullName}
        </Link>
        <p className="truncate text-xs text-faint">{application.email}</p>
      </div>
    ),
  },
  {
    key: "id",
    header: "Application",
    render: (a) => <span className="font-mono text-xs text-muted">{a.id}</span>,
  },
  { key: "country", header: "Country", render: (a) => <span className="text-muted">{a.country}</span> },
  { key: "risk", header: "Risk", render: (a) => <RiskBadge risk={a.riskLevel} score={a.riskScore} /> },
  { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  {
    key: "submitted",
    header: "Submitted",
    align: "right",
    render: (a) => <span className="text-xs text-faint">{formatDateTime(a.submittedAt)}</span>,
  },
];

function asStatus(value?: string): ReviewStatus | "open" | "decided" | "all" {
  if (value === "open" || value === "decided") return value;
  return REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as ReviewStatus) : "all";
}

function asRisk(value?: string): RiskLevel | "all" {
  return RISK_LEVELS.includes(value as RiskLevel) ? (value as RiskLevel) : "all";
}

export default function KycQueuePage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; risk?: string };
}) {
  const user = getCurrentUser();
  if (!can(user.role, "kyc:view")) {
    return <AccessDenied role={user.role} permission="kyc:view" />;
  }

  const summary = queueSummary();
  const applications = listApplications({
    search: searchParams.q,
    status: asStatus(searchParams.status),
    risk: asRisk(searchParams.risk),
  });
  const recentEvents = listAuditEvents().slice(0, 5);

  return (
    <>
      <PageHeader
        title="KYC Review Queue"
        description="Review, approve, reject or escalate customer identity verifications."
        crumbs={[{ label: "Compliance" }, { label: "KYC Review Queue" }]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          id="kyc-open"
          label="Open"
          value={summary.pending + summary.escalated}
          href="/kyc?status=open"
        />
        <Stat
          id="kyc-pending"
          label="Pending"
          value={summary.pending}
          href="/kyc?status=pending"
        />
        <Stat
          id="kyc-escalated"
          label="Escalated"
          value={summary.escalated}
          tone="warning"
          href="/kyc?status=escalated"
        />
        <Stat
          id="kyc-high-risk"
          label="High risk open"
          value={summary.highRisk}
          tone="danger"
          href="/kyc?status=open&risk=high"
        />
      </div>

      <Suspense fallback={null}>
        <QueueFilters />
      </Suspense>

      <p className="mb-2 text-xs text-faint">
        Showing {applications.length} of {summary.total} applications
      </p>

      <DataTable
        columns={COLUMNS}
        rows={applications}
        rowKey={(application) => application.id}
        emptyMessage="No applications match the current filters."
      />

      <div className="mt-6">
        <Card title="Recent audit activity" description="Latest state changes across the queue.">
          <AuditTimeline events={recentEvents} showResource />
        </Card>
      </div>
    </>
  );
}
