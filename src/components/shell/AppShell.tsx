import Link from "next/link";
import type { ReactNode } from "react";
import {
  DEMO_USERS,
  getCurrentDemoUser,
  getCurrentRole,
} from "@/lib/auth/session";
import { permissionsFor } from "@/lib/auth/rbac";
import { listApplications } from "@/lib/kyc/store";
import { listFlags } from "@/lib/flags/store";
import { formatMoney } from "@/lib/format";
import { listRefunds } from "@/lib/refunds/store";
import { REFUND_STATUS_LABELS } from "@/lib/refunds/types";
import { ENVIRONMENT_LABELS } from "@/lib/flags/types";
import { STATUS_LABELS } from "@/lib/kyc/types";
import type { Command } from "@/lib/search";
import { Kbd } from "@/components/ui/Badge";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "./CommandPalette";
import { IdentityMenu } from "./IdentityMenu";
import { SidebarNav, type NavSection } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Compliance",
    items: [{ href: "/kyc", label: "KYC Review Queue", icon: "kyc" }],
  },
  {
    title: "Operations",
    items: [{ href: "/refunds", label: "Refund Operations", icon: "refunds" }],
  },
  {
    title: "Platform",
    items: [{ href: "/flags", label: "Feature Flags", icon: "flags" }],
  },
  {
    title: "Governance",
    items: [{ href: "/audit", label: "Audit Log", icon: "audit" }],
  },
];

/** Everything reachable from ⌘K: the pages plus live case and flag records. */
function buildCommands(): Command[] {
  const pages: Command[] = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      id: `page:${item.href}`,
      group: "Pages",
      label: item.label,
      keywords: section.title,
      href: item.href,
    })),
  );

  const cases: Command[] = listApplications()
    .slice(0, 40)
    .map((application) => ({
      id: `case:${application.id}`,
      group: "KYC cases",
      label: `${application.fullName} — ${application.id}`,
      keywords: `${application.email} ${application.country} ${application.riskLevel}`,
      hint: STATUS_LABELS[application.status],
      href: `/kyc/${application.id}`,
    }));

  const flags: Command[] = listFlags().map((flag) => ({
    id: `flag:${flag.id}`,
    group: "Feature flags",
    label: `${flag.key} · ${ENVIRONMENT_LABELS[flag.environment]}`,
    keywords: `${flag.name} ${flag.owner}`,
    hint: flag.enabled ? `${flag.rolloutPercentage}%` : "off",
    href: `/flags/${flag.id}`,
  }));

  const refunds: Command[] = listRefunds().map((refund) => ({
    id: `refund:${refund.id}`,
    group: "Refund requests",
    label: `${refund.customerName} — ${refund.id}`,
    keywords: `${refund.merchant} ${refund.customerId} ${refund.transactionId}`,
    hint: `${formatMoney(refund.requestedAmountCents)} · ${REFUND_STATUS_LABELS[refund.status]}`,
    href: `/refunds/${refund.id}`,
  }));

  return [...pages, ...cases, ...refunds, ...flags];
}

export function AppShell({ children }: { children: ReactNode }) {
  const demoUser = getCurrentDemoUser();
  const role = getCurrentRole();
  const openCases = listApplications({ status: "pending" }).length;
  const escalated = listApplications({ status: "escalated" }).length;
  const pendingRefunds = listRefunds({ status: "pending" }).length;

  const badges: Record<string, number> = {
    "/kyc": openCases + escalated,
    "/refunds": pendingRefunds,
  };

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.href in badges ? { ...item, badge: badges[item.href] } : item,
    ),
  }));

  return (
    <ToastProvider>
      <div className="app-canvas flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-[var(--bg-elevated)] lg:flex">
          <Link
            href="/"
            className="flex items-center gap-2.5 border-b border-line px-4 py-3.5 transition-colors hover:bg-panel-hover"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fg to-muted text-[13px] font-bold text-on-fg shadow-subtle">
              N
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight tracking-tight text-fg">
                Northwind
              </span>
              <span className="block text-2xs text-faint">Internal Tools</span>
            </span>
          </Link>

          <SidebarNav sections={sections} />

          <div className="border-t border-line px-4 py-3">
            <div className="flex items-center justify-between text-2xs text-faint">
              <span>Command menu</span>
              <Kbd>⌘K</Kbd>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-2xs text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Prototype · in-memory data
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-translucent px-4 backdrop-blur-xl sm:px-6">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fg text-[13px] font-bold text-on-fg">
                N
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette commands={buildCommands()} />
              <ThemeToggle />
              <IdentityMenu
                users={DEMO_USERS}
                user={demoUser}
                role={role}
                permissions={permissionsFor(role)}
              />
            </div>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 lg:hidden">
            {NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg border border-line px-2.5 py-1 text-xs text-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
