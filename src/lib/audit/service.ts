import {
  appendAuditEvent,
  listAuditActors,
  listAuditEvents,
  peekNextAuditEventId,
  type AuditQuery,
} from "./log";
import { createAuditEvent, type AuditEvent, type AuditEventInput } from "./types";

export type { AuditQuery } from "./log";

/**
 * Shared audit logging service. Tools describe *what* changed and this module
 * owns event construction, id allocation, appending and querying, so no tool
 * implements its own logging.
 */

export type AuditDraft = Omit<AuditEventInput, "id" | "occurredAt"> & {
  id?: string;
  occurredAt?: Date;
};

/**
 * Builds an event without writing it. Pure state-transition functions use this
 * so an event can be produced and validated before anything is committed.
 */
export function buildAuditEvent(draft: AuditDraft): AuditEvent {
  const occurredAt = draft.occurredAt ?? new Date();
  return createAuditEvent({
    ...draft,
    id: draft.id ?? `EVT-${occurredAt.getTime()}-${draft.resourceId}-${draft.action}`,
    occurredAt,
  });
}

/** Reserves the id the next recorded event will receive. */
export function nextAuditEventId(): string {
  return peekNextAuditEventId();
}

/**
 * Appends an event to the shared log. Called from the service/store layer once
 * a state change has succeeded, never from the UI.
 */
export function recordAuditEvent(event: AuditEvent): AuditEvent {
  return appendAuditEvent(event);
}

export function queryAuditEvents(query: AuditQuery = {}): AuditEvent[] {
  return listAuditEvents(query);
}

export function auditActors(): string[] {
  return listAuditActors();
}
