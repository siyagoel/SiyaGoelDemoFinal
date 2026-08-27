import { resetAuditLog } from "@/lib/audit/log";
import {
  nextAuditEventId,
  queryAuditEvents,
  recordAuditEvent,
} from "@/lib/audit/service";
import type { AuditEvent } from "@/lib/audit/types";
import { isOpen } from "@/lib/metrics";
import { platformSeed } from "@/lib/seed/platform";
import { applyReviewAction, type ReviewCommand, type ReviewResult } from "./review";
import type { KycApplication, ReviewStatus, RiskLevel } from "./types";

export interface QueueFilters {
  search?: string;
  status?: ReviewStatus | "open" | "decided" | "all";
  risk?: RiskLevel | "all";
}

interface StoreState {
  applications: Map<string, KycApplication>;
}

/**
 * In-memory store standing in for a database. Held on globalThis so the data
 * survives Next.js dev-server module reloads within a single process.
 */
const globalStore = globalThis as typeof globalThis & {
  __kycStore?: StoreState;
};

function getState(): StoreState {
  if (!globalStore.__kycStore) {
    globalStore.__kycStore = {
      applications: new Map(
        platformSeed().applications.map((application) => [application.id, application]),
      ),
    };
  }
  return globalStore.__kycStore;
}

export function listApplications(filters: QueueFilters = {}): KycApplication[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return Array.from(getState().applications.values())
    .filter((application) => {
      if (filters.status === "open" || filters.status === "decided") {
        if (isOpen(application) !== (filters.status === "open")) return false;
      } else if (
        filters.status &&
        filters.status !== "all" &&
        application.status !== filters.status
      ) {
        return false;
      }
      if (filters.risk && filters.risk !== "all" && application.riskLevel !== filters.risk) {
        return false;
      }
      if (!search) return true;
      return [application.id, application.fullName, application.email, application.country]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getApplication(id: string): KycApplication | undefined {
  return getState().applications.get(id);
}

export function listAuditEvents(applicationId?: string): AuditEvent[] {
  return queryAuditEvents({
    resourceType: "kyc_application",
    resourceId: applicationId,
  });
}

export function recordReviewAction(
  applicationId: string,
  command: ReviewCommand,
): ReviewResult {
  const state = getState();
  const application = state.applications.get(applicationId);
  if (!application) {
    throw new Error(`Unknown application ${applicationId}`);
  }

  const result = applyReviewAction(
    application,
    { ...command, eventId: command.eventId ?? nextAuditEventId() },
    listAuditEvents(applicationId),
  );

  state.applications.set(applicationId, result.application);
  recordAuditEvent(result.event);
  return result;
}

export function queueSummary() {
  const applications = Array.from(getState().applications.values());
  const countBy = (status: ReviewStatus) =>
    applications.filter((application) => application.status === status).length;
  return {
    total: applications.length,
    pending: countBy("pending"),
    escalated: countBy("escalated"),
    highRisk: applications.filter(
      (application) =>
        application.riskLevel === "high" &&
        application.status !== "approved" &&
        application.status !== "rejected",
    ).length,
  };
}

/** Test helper: rebuild the store from the deterministic seed and clear the audit log. */
export function resetStore(): void {
  globalStore.__kycStore = undefined;
  resetAuditLog();
  getState();
}

