"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Select, TextInput } from "@/components/ui/Field";
import { ENVIRONMENT_LABELS, FLAG_ENVIRONMENTS } from "@/lib/flags/types";

export function FlagFilters({
  features,
}: {
  features: { key: string; name: string }[];
}) {
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
        placeholder="Search by key, name, description or owner"
        aria-label="Search feature flags"
        data-page-search
        className="w-80"
      />
      <Select
        aria-label="Filter by feature"
        className="w-64"
        value={searchParams.get("feature") ?? "all"}
        onChange={(event) => pushParams({ feature: event.target.value })}
      >
        <option value="all">All features</option>
        {features.map((feature) => (
          <option key={feature.key} value={feature.key}>
            {feature.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by environment"
        className="w-48"
        value={searchParams.get("environment") ?? "all"}
        onChange={(event) => pushParams({ environment: event.target.value })}
      >
        <option value="all">All environments</option>
        {FLAG_ENVIRONMENTS.map((environment) => (
          <option key={environment} value={environment}>
            {ENVIRONMENT_LABELS[environment]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by state"
        className="w-48"
        value={searchParams.get("state") ?? "all"}
        onChange={(event) => pushParams({ state: event.target.value })}
      >
        <option value="all">Enabled and disabled</option>
        <option value="enabled">Enabled only</option>
        <option value="disabled">Disabled only</option>
      </Select>
    </div>
  );
}
