import Link from "next/link";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { RiskBadge, StatusBadge } from "@/components/kyc/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Card, EmptyState } from "@/components/ui/Card";
import { BarChart, Donut, Meter } from "@/components/ui/Charts";
import { Stat } from "@/components/ui/Stat";
import { IconArrowRight } from "@/components/ui/icons";
import { queryAuditEvents } from "@/lib/audit/service";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { listFlags } from "@/lib/flags/store";
import { listApplications } from "@/lib/kyc/store";
import { formatMoney } from "@/lib/format";
import { HIGH_VALUE_REFUND_THRESHOLD_CENTS } from "@/lib/refunds/policy";
import { listRefunds } from "@/lib/refunds/store";
import { RISK_LABELS } from "@/lib/kyc/types";
import {
  agingBuckets,
  ageInDays,
  approvalRate,
  clearanceRate,
  decisionSeries,
  flagSummary,
  isOpen,
  openRiskMix,
  recentSensitiveActions,
  refundSummary,
  slaBreaches,
  statusBreakdown,
  submissionSeries,
  topActors,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

const SLA_DAYS = 3;

export default function DashboardPage() {
  const user = getCurrentUser();
  const now = new Date();

  const applications = listApplications();
  const flags = listFlags();
  const events = queryAuditEvents();

  const status = statusBreakdown(applications);
  const open = applications.filter(isOpen);
  const risk = openRiskMix(applications);
  const aging = agingBuckets(applications, now, SLA_DAYS);
  const breaches = slaBreaches(applications, now, SLA_DAYS);
  const submissions = submissionSeries(applications, now, 14);
  const decisions = decisionSeries(events, now, 14);
  const summary = flagSummary(flags);
  const refunds = refundSummary(listRefunds());
  const actors = topActors(events);
  const approval = approvalRate(applications);

  const sensitive = recentSensitiveActions(events, now);

  const productionFlags = flags
    .filter((flag) => flag.environment === "production")
    .sort((a, b) => b.rolloutPercentage - a.rolloutPercentage)
    .slice(0, 5);

  return (
    <>
      <header className="mb-7 animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-faint">
              Northwind Operations
            </p>
            <h1 className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.025em] text-fg">
              Good {now.getUTCHours() < 12 ? "morning" : now.getUTCHours() < 18 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {open.length} case{open.length === 1 ? "" : "s"} awaiting review ·{" "}
              {summary.productionEnabled} production flag{summary.productionEnabled === 1 ? "" : "s"} live · acting as{" "}
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/kyc"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-fg px-3.5 text-sm font-medium text-on-fg transition-colors hover:bg-fg-hover"
            >
              Open review queue
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          id="stat-open"
          label="Awaiting review"
          value={open.length}
          href="/kyc?status=open"
          hint={`${status.escalated} escalated · ${breaches.length} past ${SLA_DAYS}-day SLA`}
          trend={submissions.map((point) => point.value)}
        />
        <Stat
          id="stat-high-risk"
          label="High-risk open"
          value={risk.high}
          tone={risk.high > 0 ? "danger" : "success"}
          href="/kyc?status=open&risk=high"
          hint="Must be escalated before approval"
        />
        <Stat
          id="stat-escalated"
          label="Escalated"
          value={status.escalated}
          tone={status.escalated > 0 ? "warning" : "success"}
          href="/kyc?status=escalated"
          hint="Waiting on a second reviewer"
        />
        <Stat
          id="stat-clearance"
          label="Cleared"
          value={`${clearanceRate(applications)}%`}
          href="/kyc?status=decided"
          hint={
            approval === null
              ? "No decisions recorded yet"
              : `${approval}% of decisions were approvals`
          }
          tone="success"
          trend={decisions.map((point) => point.value)}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          id="stat-flags-live"
          label="Production flags live"
          value={`${summary.productionEnabled}/${summary.production}`}
          href="/flags?environment=production&state=enabled"
          hint={`${summary.fullyRolledOut} at 100% · ${summary.partialRollouts} staged`}
          tone="accent"
        />
        <Stat
          id="stat-sensitive"
          label="Sensitive actions (72h)"
          value={sensitive.length}
          href="/audit?sensitive=true&window=72h"
          tone={sensitive.length > 0 ? "warning" : "info"}
          hint="Rejections, escalations, refund decisions and flag changes"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          id="stat-refunds-pending"
          label="Refunds awaiting review"
          value={refunds.pending}
          href="/refunds?status=pending"
          hint={
            refunds.approvalRate === null
              ? "No refund decisions recorded yet"
              : `${refunds.approvalRate}% of decisions were approvals`
          }
        />
        <Stat
          id="stat-refunds-high-value"
          label="High-value refunds"
          value={refunds.highValuePending}
          tone={refunds.highValuePending > 0 ? "warning" : "success"}
          href="/refunds?status=pending&value=high_value"
          hint={`${formatMoney(HIGH_VALUE_REFUND_THRESHOLD_CENTS)}+ · decided by an Admin`}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Queue throughput"
            description="Submissions received against decisions recorded, last 14 days."
          >
            <div className="mb-3 flex items-center gap-4 text-2xs text-faint">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full bg-accent" /> Submitted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full bg-success" /> Decided
              </span>
            </div>
            <BarChart data={submissions.map((p) => ({ label: p.label, value: p.value }))} height={104} />
            <div className="mt-2 border-t border-line pt-2">
              <BarChart
                data={decisions.map((p) => ({ label: p.label, value: p.value }))}
                tone="success"
                height={44}
              />
            </div>
            <div className="mt-2 flex justify-between text-2xs text-faint">
              <span>{submissions[0]?.label}</span>
              <span>{submissions[submissions.length - 1]?.label}</span>
            </div>
          </Card>
        </div>

        <Card title="Open risk mix" description="Risk level of everything still in the queue.">
          <div className="flex items-center gap-5">
            <Donut
              slices={[
                { label: RISK_LABELS.high, value: risk.high, tone: "danger" },
                { label: RISK_LABELS.medium, value: risk.medium, tone: "warning" },
                { label: RISK_LABELS.low, value: risk.low, tone: "success" },
              ]}
              center={
                <>
                  <span className="font-mono text-2xl font-medium leading-none text-fg">
                    {open.length}
                  </span>
                  <span className="mt-1 text-2xs text-faint">open</span>
                </>
              }
            />
            <ul className="min-w-0 flex-1 space-y-1">
              {(
                [
                  ["high", risk.high, "bg-danger"],
                  ["medium", risk.medium, "bg-warning"],
                  ["low", risk.low, "bg-success"],
                ] as const
              ).map(([level, value, dot]) => (
                <li key={level}>
                  <Link
                    href={`/kyc?status=open&risk=${level}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-panel-hover"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    <span className="flex-1 capitalize text-muted">{level}</span>
                    <span className="font-mono text-fg">{value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 space-y-2 border-t border-line pt-3">
            {aging.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-faint">{bucket.label}</span>
                <div className="flex-1">
                  <Meter
                    value={open.length === 0 ? 0 : (bucket.value / open.length) * 100}
                    tone={bucket.breach ? "danger" : "accent"}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-mono text-muted">{bucket.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title={`Needs attention`}
          description={`Open cases older than ${SLA_DAYS} days, oldest first.`}
          actions={
            <Link href="/kyc" className="text-xs text-muted transition-colors hover:text-fg">
              View queue
            </Link>
          }
          padded={false}
        >
          {breaches.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState title="Nothing past SLA" description="Every open case is inside the review window." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {breaches.slice(0, 5).map((application) => (
                <li key={application.id}>
                  <Link
                    href={`/kyc/${application.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-fg">{application.fullName}</span>
                      <span className="block font-mono text-2xs text-faint">{application.id}</span>
                    </span>
                    <RiskBadge risk={application.riskLevel} />
                    <StatusBadge status={application.status} />
                    <span className="w-14 shrink-0 text-right font-mono text-2xs text-faint">
                      {ageInDays(application, now)}d
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Production flags"
          description="Highest rollout first."
          actions={
            <Link href="/flags" className="text-xs text-muted transition-colors hover:text-fg">
              View flags
            </Link>
          }
          padded={false}
        >
          <ul className="divide-y divide-line">
            {productionFlags.map((flag) => (
              <li key={flag.id}>
                <Link
                  href={`/flags/${flag.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px] text-fg">{flag.key}</span>
                    <span className="mt-1.5 block">
                      <Meter
                        value={flag.enabled ? flag.rolloutPercentage : 0}
                        tone={flag.rolloutPercentage === 100 ? "warning" : "accent"}
                      />
                    </span>
                  </span>
                  <Badge tone={flag.enabled ? "success" : "neutral"} dot>
                    {flag.enabled ? `${flag.rolloutPercentage}%` : "Off"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Recent platform activity"
            description="Every tool writes to the same append-only audit log."
            actions={
              <Link href="/audit" className="text-xs text-muted transition-colors hover:text-fg">
                Full log
              </Link>
            }
          >
            <AuditTimeline events={events.slice(0, 6)} showResource />
          </Card>
        </div>
        <Card title="Most active" description="Actors on the audit log.">
          {actors.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {actors.map((actor) => (
                <li key={actor.actor} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[10px] font-semibold uppercase text-accent">
                    {actor.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{actor.name}</span>
                    <span className="block truncate text-2xs text-faint">{actor.actor}</span>
                  </span>
                  <span className="font-mono text-sm text-muted">{actor.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
