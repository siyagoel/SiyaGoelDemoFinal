"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Select, TextInput } from "@/components/ui/Field";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_ACTIONS,
  AUDIT_RESOURCE_LABELS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_WINDOWS,
  isAuditResourceType,
} from "@/lib/audit/types";

export function AuditFilters({ actors }: { actors: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (current === search) return;
    const timer = setTimeout(() => pushParams({ q: search }), 250);
    return () => clearTimeout(timer);
  }, [search, searchParams, pushParams]);

  const resourceType = searchParams.get("resource") ?? "all";
  const actions = isAuditResourceType(resourceType)
    ? AUDIT_RESOURCE_ACTIONS[resourceType]
    : AUDIT_RESOURCE_TYPES.flatMap((type) => AUDIT_RESOURCE_ACTIONS[type]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <TextInput
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by resource, actor or reason"
        aria-label="Search audit events"
        data-page-search
        className="w-80"
      />
      <Select
        aria-label="Filter by application"
        className="w-48"
        value={resourceType}
        onChange={(event) => pushParams({ resource: event.target.value, action: "all" })}
      >
        <option value="all">All applications</option>
        {AUDIT_RESOURCE_TYPES.map((type) => (
          <option key={type} value={type}>
            {AUDIT_RESOURCE_LABELS[type]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by action"
        className="w-44"
        value={searchParams.get("action") ?? "all"}
        onChange={(event) => pushParams({ action: event.target.value })}
      >
        <option value="all">All actions</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {AUDIT_ACTION_LABELS[action]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by time window"
        className="w-40"
        value={searchParams.get("window") ?? "all"}
        onChange={(event) => pushParams({ window: event.target.value })}
      >
        <option value="all">Any time</option>
        {AUDIT_WINDOWS.map((window) => (
          <option key={window.value} value={window.value}>
            {window.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by sensitivity"
        className="w-44"
        value={searchParams.get("sensitive") === "true" ? "true" : "all"}
        onChange={(event) => pushParams({ sensitive: event.target.value })}
      >
        <option value="all">All events</option>
        <option value="true">Sensitive only</option>
      </Select>
      <Select
        aria-label="Filter by actor"
        className="w-56"
        value={searchParams.get("actor") ?? "all"}
        onChange={(event) => pushParams({ actor: event.target.value })}
        disabled={actors.length === 0}
      >
        <option value="all">All actors</option>
        {actors.map((actor) => (
          <option key={actor} value={actor}>
            {actor}
          </option>
        ))}
      </Select>
    </div>
  );
}
