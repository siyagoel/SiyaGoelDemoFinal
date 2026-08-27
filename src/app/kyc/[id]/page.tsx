import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { ReviewActions } from "@/components/kyc/ReviewActions";
import { RiskBadge, StatusBadge } from "@/components/kyc/StatusBadges";
import { Card, DescriptionList } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { can, deniedMessage } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { getApplication, listAuditEvents } from "@/lib/kyc/store";
import {
  canApply,
  escalatedBy,
  escalatedByActor,
  isTerminal,
  requiresReviewerNote,
  SEPARATION_OF_DUTIES_MESSAGE,
} from "@/lib/kyc/review";
import { STATUS_LABELS } from "@/lib/kyc/types";

export const dynamic = "force-dynamic";

const DOCUMENT_LABELS: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's licence",
  national_id: "National ID",
  proof_of_address: "Proof of address",
};

export default function ApplicantDetailPage({ params }: { params: { id: string } }) {
  const application = getApplication(params.id);
  if (!application) notFound();

  const events = listAuditEvents(application.id);
  const closed = isTerminal(application.status);
  const user = getCurrentUser();
  const escalator = escalatedBy(events);
  const decisionBlocked = escalatedByActor(user.email, events);
  const canDecide = can(user.role, "kyc:decide");

  if (!can(user.role, "kyc:view")) {
    return <AccessDenied role={user.role} permission="kyc:view" />;
  }

  return (
    <>
      <PageHeader
        title={application.fullName}
        description={`Submitted ${formatDateTime(application.submittedAt)} · ${application.email}`}
        crumbs={[
          { label: "Compliance" },
          { label: "KYC Review Queue", href: "/kyc" },
          { label: application.id },
        ]}
        meta={
          <>
            <RiskBadge risk={application.riskLevel} score={application.riskScore} />
            <StatusBadge status={application.status} />
            <span className="font-mono text-xs text-faint">{application.id}</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Applicant">
            <DescriptionList
              items={[
                { label: "Email", value: application.email },
                { label: "Country", value: application.country },
                { label: "Date of birth", value: formatDate(application.dateOfBirth) },
                { label: "Risk score", value: `${application.riskScore} / 100` },
                { label: "Status", value: STATUS_LABELS[application.status] },
                {
                  label: "Decision",
                  value: application.decidedAt
                    ? `${formatDateTime(application.decidedAt)}${
                        application.decisionReason ? ` · ${application.decisionReason}` : ""
                      }`
                    : "—",
                },
              ]}
            />
          </Card>

          <Card title="Risk flags" description="Raised by automated screening.">
            {application.flags.length === 0 ? (
              <p className="text-sm text-faint">No flags raised by screening.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {application.flags.map((flag) => (
                  <li
                    key={flag}
                    className="rounded-lg border border-[rgba(251,191,36,0.24)] bg-[var(--warning-soft)] px-2.5 py-1.5 text-xs text-warning"
                  >
                    {flag}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Documents">
            <ul className="divide-y divide-line text-sm">
              {application.documents.map((document) => (
                <li key={document.reference} className="flex justify-between gap-3 py-2.5">
                  <span className="text-muted">
                    {DOCUMENT_LABELS[document.type] ?? document.type}
                  </span>
                  <span className="font-mono text-xs text-faint">{document.reference}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Review decision">
            <ReviewActions
              applicationId={application.id}
              applicantName={application.fullName}
              canDecide={canDecide}
              permissionMessage={deniedMessage(user.role, "kyc:decide")}
              disabled={closed}
              disabledMessage={`This application was ${STATUS_LABELS[
                application.status
              ].toLowerCase()} and is immutable.`}
              canEscalate={application.status !== "escalated"}
              canApprove={canApply(application, "approve", {
                actor: user.email,
                history: events,
              })}
              canReject={canApply(application, "reject", {
                actor: user.email,
                history: events,
              })}
              decisionBlockedMessage={decisionBlocked ? SEPARATION_OF_DUTIES_MESSAGE : undefined}
              noteRequiredToApprove={requiresReviewerNote(application, "approve")}
            />
          </Card>

          <Card
            title="Audit history"
            description={
              escalator
                ? `Append-only record of every state change. Escalated by ${escalator}.`
                : "Append-only record of every state change."
            }
          >
            <AuditTimeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}
