"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGauge,
  IconHistory,
  IconMoney,
  IconShield,
  IconToggle,
} from "@/components/ui/icons";

export type NavIcon = "dashboard" | "kyc" | "refunds" | "flags" | "audit";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ICONS: Record<NavIcon, (props: { className?: string }) => JSX.Element> = {
  dashboard: IconGauge,
  kyc: IconShield,
  refunds: IconMoney,
  flags: IconToggle,
  audit: IconHistory,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1.5 text-2xs font-medium uppercase tracking-wider text-faint">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "bg-panel-hover font-medium text-fg"
                        : "text-muted hover:bg-overlay-1 hover:text-fg"
                    }`}
                  >
                    {active ? (
                      <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                    ) : null}
                    <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-faint group-hover:text-muted"}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {typeof item.badge === "number" && item.badge > 0 ? (
                      <span className="rounded-full bg-overlay-2 px-1.5 font-mono text-[10px] text-muted">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
