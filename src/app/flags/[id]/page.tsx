import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { FlagControls } from "@/components/flags/FlagControls";
import { Badge } from "@/components/ui/Badge";
import { Card, DescriptionList } from "@/components/ui/Card";
import { Meter } from "@/components/ui/Charts";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { can, deniedMessage } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getFlag, listFlagAuditEvents, listFlags } from "@/lib/flags/store";
import { ENVIRONMENT_LABELS } from "@/lib/flags/types";

export const dynamic = "force-dynamic";

export default function FlagDetailPage({ params }: { params: { id: string } }) {
  const flag = getFlag(decodeURIComponent(params.id));
  if (!flag) notFound();

  const user = getCurrentUser();
  if (!can(user.role, "flags:view")) {
    return <AccessDenied role={user.role} permission="flags:view" />;
  }

  const events = listFlagAuditEvents(flag.id);
  const siblings = listFlags().filter(
    (candidate) => candidate.key === flag.key && candidate.id !== flag.id,
  );

  return (
    <>
      <PageHeader
        title={flag.name}
        description={flag.description}
        crumbs={[
          { label: "Platform" },
          { label: "Feature Flags", href: "/flags" },
          { label: flag.key },
        ]}
        meta={
          <>
            <Badge tone={flag.environment === "production" ? "info" : "neutral"}>
              {ENVIRONMENT_LABELS[flag.environment]}
            </Badge>
            <Badge tone={flag.enabled ? "success" : "neutral"} dot>
              {flag.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-xs text-faint">owned by {flag.owner}</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Configuration">
            <DescriptionList
              items={[
                { label: "Environment", value: ENVIRONMENT_LABELS[flag.environment] },
                { label: "State", value: flag.enabled ? "Enabled" : "Disabled" },
                { label: "Rollout", value: `${flag.rolloutPercentage}% of traffic` },
                { label: "Last updated", value: formatDateTime(flag.updatedAt) },
              ]}
            />
          </Card>

          <Card title="Other environments" description="The same flag key across the platform.">
            <ul className="divide-y divide-line text-sm">
              {siblings.map((sibling) => (
                <li key={sibling.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/flags/${sibling.id}`}
                    className="font-medium text-fg transition-colors hover:text-accent"
                  >
                    {ENVIRONMENT_LABELS[sibling.environment]}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="hidden w-24 sm:block">
                      <Meter value={sibling.enabled ? sibling.rolloutPercentage : 0} />
                    </span>
                    <span className="w-10 text-right font-mono text-xs text-muted">
                      {sibling.rolloutPercentage}%
                    </span>
                    <Badge tone={sibling.enabled ? "success" : "neutral"} dot>
                      {sibling.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Change flag" description="Changes require confirmation before they apply.">
            <FlagControls
              flag={flag}
              canManage={can(user.role, "flags:manage")}
              permissionMessage={deniedMessage(user.role, "flags:manage")}
            />
          </Card>

          <Card title="Audit history" description="Append-only record of every state change.">
            <AuditTimeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}
