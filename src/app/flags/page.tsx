import Link from "next/link";
import { Suspense } from "react";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { FlagFilters } from "@/components/flags/FlagFilters";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Meter } from "@/components/ui/Charts";
import { Stat } from "@/components/ui/Stat";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { can } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import {
  flagSummary,
  listFeatures,
  listFlagAuditEvents,
  listFlags,
} from "@/lib/flags/store";
import {
  ENVIRONMENT_LABELS,
  FLAG_ENVIRONMENTS,
  type FeatureFlag,
  type FlagEnvironment,
} from "@/lib/flags/types";

export const dynamic = "force-dynamic";

const COLUMNS: Column<FeatureFlag>[] = [
  {
    key: "flag",
    header: "Flag",
    render: (flag) => (
      <div className="min-w-0">
        <Link
          href={`/flags/${flag.id}`}
          className="font-medium text-fg transition-colors hover:text-accent"
        >
          {flag.name}
        </Link>
        <p className="truncate font-mono text-xs text-faint">{flag.key}</p>
      </div>
    ),
  },
  {
    key: "environment",
    header: "Environment",
    render: (flag) => (
      <Badge tone={flag.environment === "production" ? "info" : "neutral"}>
        {ENVIRONMENT_LABELS[flag.environment]}
      </Badge>
    ),
  },
  {
    key: "state",
    header: "State",
    render: (flag) => (
      <Badge tone={flag.enabled ? "success" : "neutral"} dot>
        {flag.enabled ? "Enabled" : "Disabled"}
      </Badge>
    ),
  },
  {
    key: "rollout",
    header: "Rollout",
    render: (flag) => (
      <div className="flex items-center gap-2">
        <div className="w-24">
          <Meter
            value={flag.enabled ? flag.rolloutPercentage : 0}
            tone={flag.rolloutPercentage === 100 ? "warning" : "accent"}
          />
        </div>
        <span className="font-mono text-xs text-muted">{flag.rolloutPercentage}%</span>
      </div>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    render: (flag) => <span className="text-xs text-muted">{flag.owner}</span>,
  },
  {
    key: "updated",
    header: "Updated",
    align: "right",
    render: (flag) => <span className="text-xs text-faint">{formatDateTime(flag.updatedAt)}</span>,
  },
];

function asEnvironment(value?: string): FlagEnvironment | "all" {
  return FLAG_ENVIRONMENTS.includes(value as FlagEnvironment)
    ? (value as FlagEnvironment)
    : "all";
}

function asState(value?: string): "all" | "enabled" | "disabled" {
  return value === "enabled" || value === "disabled" ? value : "all";
}

export default function FlagsPage({
  searchParams,
}: {
  searchParams: { q?: string; feature?: string; environment?: string; state?: string };
}) {
  const user = getCurrentUser();
  if (!can(user.role, "flags:view")) {
    return <AccessDenied role={user.role} permission="flags:view" />;
  }

  const summary = flagSummary();
  const features = listFeatures();
  const flags = listFlags({
    search: searchParams.q,
    key: features.some((feature) => feature.key === searchParams.feature)
      ? searchParams.feature
      : "all",
    environment: asEnvironment(searchParams.environment),
    state: asState(searchParams.state),
  });
  const recentEvents = listFlagAuditEvents().slice(0, 5);

  return (
    <>
      <PageHeader
        title="Feature Flags"
        description="Toggle flags and adjust rollout per environment. Every change is confirmed and audited."
        crumbs={[{ label: "Platform" }, { label: "Feature Flags" }]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat id="flags-keys" label="Features" value={summary.keys} />
        <Stat id="flags-configs" label="Environment configs" value={summary.total} />
        <Stat
          id="flags-prod"
          label="Enabled in prod"
          value={summary.enabledInProduction}
          href="/flags?environment=production&state=enabled"
          tone="success"
        />
      </div>

      <Suspense fallback={null}>
        <FlagFilters features={features} />
      </Suspense>

      <p className="mb-2 text-xs text-faint">
        Showing {flags.length} of {summary.total} flag configurations
      </p>

      <DataTable
        columns={COLUMNS}
        rows={flags}
        rowKey={(flag) => flag.id}
        emptyMessage="No feature flags match the current filters."
      />

      <div className="mt-6">
        <Card title="Recent audit activity" description="Latest flag changes across environments.">
          <AuditTimeline events={recentEvents} showResource />
        </Card>
      </div>
    </>
  );
}
