import Link from "next/link";
import { Suspense } from "react";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { formatChange } from "@/components/audit/AuditTimeline";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { auditActors, queryAuditEvents } from "@/lib/audit/service";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_LABELS,
  AUDIT_WINDOWS,
  isAuditAction,
  isAuditResourceType,
  type AuditAction,
  type AuditEvent,
  type AuditResourceType,
} from "@/lib/audit/types";
import { can, isRole, ROLE_LABELS } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_TONES: Record<AuditAction, BadgeTone> = {
  KYC_APPROVED: "success",
  KYC_REJECTED: "danger",
  KYC_ESCALATED: "warning",
  FLAG_ENABLED: "success",
  FLAG_DISABLED: "neutral",
  ROLLOUT_CHANGED: "info",
  REFUND_APPROVED: "success",
  REFUND_DENIED: "danger",
};

const RESOURCE_HREF: Record<AuditResourceType, (id: string) => string> = {
  kyc_application: (id) => `/kyc/${id}`,
  feature_flag: (id) => `/flags/${id}`,
  refund_request: (id) => `/refunds/${id}`,
};

const COLUMNS: Column<AuditEvent>[] = [
  {
    key: "when",
    header: "When",
    render: (event) => (
      <div>
        <p className="whitespace-nowrap text-xs text-muted">{formatDateTime(event.occurredAt)}</p>
        <p className="font-mono text-2xs text-faint">{event.id}</p>
      </div>
    ),
  },
  {
    key: "action",
    header: "Action",
    render: (event) => (
      <div className="space-y-1">
        <Badge tone={ACTION_TONES[event.action]} dot>
          {AUDIT_ACTION_LABELS[event.action]}
        </Badge>
        <p className="font-mono text-2xs text-faint">{event.action}</p>
      </div>
    ),
  },
  {
    key: "resource",
    header: "Resource",
    render: (event) => (
      <div>
        <Link
          href={RESOURCE_HREF[event.resourceType](event.resourceId)}
          className="font-medium text-fg transition-colors hover:text-accent"
        >
          {event.resourceLabel}
        </Link>
        <p className="text-2xs text-faint">
          {AUDIT_RESOURCE_LABELS[event.resourceType]} · {event.resourceId}
        </p>
      </div>
    ),
  },
  {
    key: "change",
    header: "Change",
    render: (event) => (
      <span className="font-mono text-xs text-muted">{formatChange(event) ?? "—"}</span>
    ),
  },
  {
    key: "actor",
    header: "Actor",
    render: (event) => (
      <div>
        <p className="text-xs font-medium text-fg">{event.actorName ?? event.actor}</p>
        <p className="text-2xs text-faint">{event.actor}</p>
        {event.actorRole ? (
          <p className="text-2xs text-faint">
            {isRole(event.actorRole) ? ROLE_LABELS[event.actorRole] : event.actorRole}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "reason",
    header: "Reason / note",
    render: (event) => (
      <span className="text-xs text-muted">{event.reason ?? "—"}</span>
    ),
  },
];

export default function AuditPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    resource?: string;
    action?: string;
    actor?: string;
    window?: string;
    sensitive?: string;
  };
}) {
  const user = getCurrentUser();
  if (!can(user.role, "audit:view")) {
    return <AccessDenied role={user.role} permission="audit:view" />;
  }

  const actor = searchParams.actor && searchParams.actor !== "all" ? searchParams.actor : undefined;
  const events = queryAuditEvents({
    search: searchParams.q,
    resourceType: isAuditResourceType(searchParams.resource) ? searchParams.resource : "all",
    action: isAuditAction(searchParams.action) ? searchParams.action : "all",
    actor,
    sensitiveOnly: searchParams.sensitive === "true",
    withinHours: AUDIT_WINDOWS.find((window) => window.value === searchParams.window)?.hours,
  });
  const total = queryAuditEvents().length;

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Append-only record of every sensitive action across the internal tools platform."
        crumbs={[{ label: "Governance" }, { label: "Audit Log" }]}
        meta={
          <Badge tone="neutral" dot>
            Append-only
          </Badge>
        }
      />

      <Suspense fallback={null}>
        <AuditFilters actors={auditActors()} />
      </Suspense>

      <p className="mb-2 text-xs text-faint">
        Showing {events.length} of {total} events, newest first
      </p>

      <DataTable
        columns={COLUMNS}
        rows={events}
        rowKey={(event) => event.id}
        emptyMessage="No audit events match the current filters."
      />
    </>
  );
}
