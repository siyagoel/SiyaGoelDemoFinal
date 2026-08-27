import { resetAuditLog } from "@/lib/audit/log";
import {
  nextAuditEventId,
  queryAuditEvents,
  recordAuditEvent,
} from "@/lib/audit/service";
import type { AuditEvent } from "@/lib/audit/types";
import type { RiskLevel } from "@/lib/kyc/types";
import { platformSeed } from "@/lib/seed/platform";
import { applyRefundDecision, RefundError, type RefundCommand, type RefundResult } from "./mutations";
import { isHighValueRefund } from "./policy";
import type { RefundRequest, RefundStatus } from "./types";

export type RefundValueFilter = "all" | "high_value" | "standard";

export interface RefundQueueFilters {
  search?: string;
  status?: RefundStatus | "all";
  risk?: RiskLevel | "all";
  value?: RefundValueFilter;
  /** Only requests raised within this many days. */
  withinDays?: number;
}

interface StoreState {
  refunds: Map<string, RefundRequest>;
}

/**
 * In-memory store standing in for a database, held on globalThis so the data
 * survives Next.js dev-server module reloads within a single process.
 */
const globalStore = globalThis as typeof globalThis & {
  __refundStore?: StoreState;
};

function getState(): StoreState {
  if (!globalStore.__refundStore) {
    globalStore.__refundStore = {
      refunds: new Map(platformSeed().refunds.map((refund) => [refund.id, refund])),
    };
  }
  return globalStore.__refundStore;
}

export function listRefunds(filters: RefundQueueFilters = {}): RefundRequest[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const cutoff =
    filters.withinDays !== undefined
      ? Date.now() - filters.withinDays * 86_400_000
      : null;

  return Array.from(getState().refunds.values())
    .filter((refund) => {
      if (filters.status && filters.status !== "all" && refund.status !== filters.status) {
        return false;
      }
      if (filters.risk && filters.risk !== "all" && refund.riskLevel !== filters.risk) {
        return false;
      }
      if (filters.value && filters.value !== "all") {
        const high = isHighValueRefund(refund.requestedAmountCents);
        if (filters.value === "high_value" ? !high : high) return false;
      }
      if (cutoff !== null && new Date(refund.requestedAt).getTime() < cutoff) {
        return false;
      }
      if (!search) return true;
      return [
        refund.id,
        refund.customerName,
        refund.customerId,
        refund.merchant,
        refund.transactionId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function getRefund(id: string): RefundRequest | undefined {
  return getState().refunds.get(id);
}

/** Refund history comes from the one shared audit log, not a separate table. */
export function listRefundAuditEvents(refundId?: string): AuditEvent[] {
  return queryAuditEvents({ resourceType: "refund_request", resourceId: refundId });
}

export function recordRefundDecision(
  refundId: string,
  command: RefundCommand,
): RefundResult {
  const state = getState();
  const refund = state.refunds.get(refundId);
  if (!refund) {
    throw new RefundError(`Unknown refund request ${refundId}`);
  }

  const result = applyRefundDecision(refund, {
    ...command,
    eventId: command.eventId ?? nextAuditEventId(),
  });

  state.refunds.set(refundId, result.refund);
  recordAuditEvent(result.event);
  return result;
}

/** Test helper: rebuild the store from the deterministic seed and clear the audit log. */
export function resetRefundStore(): void {
  globalStore.__refundStore = undefined;
  resetAuditLog();
  getState();
}
