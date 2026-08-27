import { platformSeed } from "@/lib/seed/platform";
import {
  isSensitiveAuditAction,
  type AuditAction,
  type AuditEvent,
  type AuditResourceType,
} from "./types";

interface AuditLogState {
  events: AuditEvent[];
  sequence: number;
}

/**
 * Append-only audit log shared by every tool. Held on globalThis so it
 * survives Next.js dev-server module reloads within a single process.
 */
const globalLog = globalThis as typeof globalThis & {
  __auditLog?: AuditLogState;
};

function getLog(): AuditLogState {
  if (!globalLog.__auditLog) {
    const seeded = platformSeed().events;
    globalLog.__auditLog = { events: [...seeded], sequence: seeded.length };
  }
  return globalLog.__auditLog;
}

/** Reserves the next event id without committing anything to the log. */
export function peekNextAuditEventId(): string {
  return `EVT-${(getLog().sequence + 1).toString().padStart(5, "0")}`;
}

export function appendAuditEvent(event: AuditEvent): AuditEvent {
  const log = getLog();
  log.sequence += 1;
  log.events.push(event);
  return event;
}

export interface AuditQuery {
  resourceType?: AuditResourceType | "all";
  resourceId?: string;
  action?: AuditAction | "all";
  /** Substring match on the actor's email. */
  actor?: string;
  /** Substring match on resource label, resource id, reason and actor. */
  search?: string;
  /** Keep only actions an operator is expected to review. */
  sensitiveOnly?: boolean;
  /** Keep only events recorded in the last N hours. */
  withinHours?: number;
  limit?: number;
}

function matches(event: AuditEvent, query: AuditQuery, now: number): boolean {
  if (query.sensitiveOnly && !isSensitiveAuditAction(event.action)) return false;
  if (
    query.withinHours !== undefined &&
    Date.parse(event.occurredAt) < now - query.withinHours * 3_600_000
  ) {
    return false;
  }
  if (query.resourceType && query.resourceType !== "all") {
    if (event.resourceType !== query.resourceType) return false;
  }
  if (query.resourceId && event.resourceId !== query.resourceId) return false;
  if (query.action && query.action !== "all" && event.action !== query.action) return false;

  const actor = query.actor?.trim().toLowerCase();
  if (actor && !event.actor.toLowerCase().includes(actor)) return false;

  const search = query.search?.trim().toLowerCase();
  if (
    search &&
    ![
      event.resourceLabel,
      event.resourceId,
      event.reason ?? "",
      event.actor,
      event.actorName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }

  return true;
}

/** Most recent events first. */
export function listAuditEvents(query: AuditQuery = {}): AuditEvent[] {
  const now = Date.now();
  const events = getLog()
    .events.filter((event) => matches(event, query, now))
    .reverse();
  return query.limit ? events.slice(0, query.limit) : events;
}

/** Distinct actors that have written events, for the audit log filters. */
export function listAuditActors(): string[] {
  return Array.from(new Set(getLog().events.map((event) => event.actor))).sort();
}

/** Test helper: empty the audit log. */
export function resetAuditLog(): void {
  globalLog.__auditLog = { events: [], sequence: 0 };
}
