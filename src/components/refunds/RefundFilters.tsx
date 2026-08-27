"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Select, TextInput } from "@/components/ui/Field";
import { RISK_LABELS, RISK_LEVELS } from "@/lib/kyc/types";
import {
  REFUND_STATUS_LABELS,
  REFUND_STATUSES,
  REFUND_WINDOWS,
} from "@/lib/refunds/types";

export function RefundFilters() {
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

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <TextInput
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by customer, merchant, refund or transaction ID"
        aria-label="Search refund requests"
        data-page-search
        className="w-80"
      />
      <Select
        aria-label="Filter by status"
        className="w-40"
        value={searchParams.get("status") ?? "all"}
        onChange={(event) => pushParams({ status: event.target.value })}
      >
        <option value="all">All statuses</option>
        {REFUND_STATUSES.map((status) => (
          <option key={status} value={status}>
            {REFUND_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by amount"
        className="w-44"
        value={searchParams.get("value") ?? "all"}
        onChange={(event) => pushParams({ value: event.target.value })}
      >
        <option value="all">Any amount</option>
        <option value="high_value">High value only</option>
        <option value="standard">Below threshold</option>
      </Select>
      <Select
        aria-label="Filter by risk level"
        className="w-40"
        value={searchParams.get("risk") ?? "all"}
        onChange={(event) => pushParams({ risk: event.target.value })}
      >
        <option value="all">All risk levels</option>
        {RISK_LEVELS.map((risk) => (
          <option key={risk} value={risk}>
            {RISK_LABELS[risk]} risk
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by request date"
        className="w-40"
        value={searchParams.get("window") ?? "all"}
        onChange={(event) => pushParams({ window: event.target.value })}
      >
        <option value="all">Any date</option>
        {REFUND_WINDOWS.map((window) => (
          <option key={window.value} value={window.value}>
            {window.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
