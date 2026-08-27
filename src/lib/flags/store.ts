import { resetAuditLog } from "@/lib/audit/log";
import {
  nextAuditEventId,
  queryAuditEvents,
  recordAuditEvent,
} from "@/lib/audit/service";
import type { AuditEvent } from "@/lib/audit/types";
import { applyFlagChange, type FlagCommand, type FlagResult } from "./mutations";
import { platformSeed } from "@/lib/seed/platform";
import type { FeatureFlag, FlagEnvironment } from "./types";

export interface FlagFilters {
  search?: string;
  key?: string | "all";
  environment?: FlagEnvironment | "all";
  state?: "all" | "enabled" | "disabled";
}

interface FlagStoreState {
  flags: Map<string, FeatureFlag>;
}

const globalStore = globalThis as typeof globalThis & {
  __flagStore?: FlagStoreState;
};

function getState(): FlagStoreState {
  if (!globalStore.__flagStore) {
    globalStore.__flagStore = {
      flags: new Map(platformSeed().flags.map((flag) => [flag.id, flag])),
    };
  }
  return globalStore.__flagStore;
}

export function listFlags(filters: FlagFilters = {}): FeatureFlag[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return Array.from(getState().flags.values())
    .filter((flag) => {
      if (
        filters.environment &&
        filters.environment !== "all" &&
        flag.environment !== filters.environment
      ) {
        return false;
      }
      if (filters.key && filters.key !== "all" && flag.key !== filters.key) {
        return false;
      }
      if (filters.state === "enabled" && !flag.enabled) return false;
      if (filters.state === "disabled" && flag.enabled) return false;
      if (!search) return true;
      return [flag.key, flag.name, flag.description, flag.owner]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => a.key.localeCompare(b.key) || a.environment.localeCompare(b.environment));
}

/** The distinct features behind the flag/environment rows, for filter menus. */
export function listFeatures(): { key: string; name: string }[] {
  const features = new Map<string, string>();
  for (const flag of getState().flags.values()) {
    features.set(flag.key, flag.name);
  }
  return Array.from(features, ([key, name]) => ({ key, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getFlag(id: string): FeatureFlag | undefined {
  return getState().flags.get(id);
}

export function listFlagAuditEvents(flagId?: string): AuditEvent[] {
  return queryAuditEvents({ resourceType: "feature_flag", resourceId: flagId });
}

export function recordFlagChange(flagId: string, command: FlagCommand): FlagResult {
  const state = getState();
  const flag = state.flags.get(flagId);
  if (!flag) {
    throw new Error(`Unknown feature flag ${flagId}`);
  }

  const result = applyFlagChange(flag, {
    ...command,
    eventId: command.eventId ?? nextAuditEventId(),
  });

  state.flags.set(flagId, result.flag);
  recordAuditEvent(result.event);
  return result;
}

export function flagSummary() {
  const flags = Array.from(getState().flags.values());
  const production = flags.filter((flag) => flag.environment === "production");
  return {
    total: flags.length,
    keys: new Set(flags.map((flag) => flag.key)).size,
    enabledInProduction: production.filter((flag) => flag.enabled).length,
  };
}

/** Test helper: rebuild the flag store from the seed and clear the audit log. */
export function resetFlagStore(): void {
  globalStore.__flagStore = undefined;
  resetAuditLog();
  getState();
}
