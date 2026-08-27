"use client";

import { useEffect, useRef, useState } from "react";
import { switchDemoUser, switchRole } from "@/lib/auth/actions";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLES,
  type Permission,
  type Role,
} from "@/lib/auth/rbac";
import type { DemoUser } from "@/lib/auth/session";
import { IconCheck, IconChevron, IconLock } from "@/components/ui/icons";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/**
 * Prototype stand-in for SSO. Identity (who acts) and the simulated role (what
 * they may do) are separate selections; replacing this with a real session
 * provider does not touch any enforcement code.
 */
export function IdentityMenu({
  users,
  user,
  role,
  permissions,
}: {
  users: DemoUser[];
  user: DemoUser;
  role: Role;
  permissions: readonly Permission[];
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 items-center gap-2 rounded-lg border border-line bg-elevated pl-1 pr-2 text-left transition-colors hover:border-line-strong"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-[10px] font-semibold uppercase text-accent">
          {initials(user.name)}
        </span>
        <span className="hidden text-xs font-medium text-fg sm:block">{user.name}</span>
        <span className="hidden rounded border border-line px-1 text-2xs text-muted md:block">
          {ROLE_LABELS[role]}
        </span>
        <IconChevron className="h-3.5 w-3.5 text-faint" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[19rem] overflow-hidden rounded-xl border border-line-strong bg-elevated shadow-overlay animate-pop"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="text-2xs font-medium uppercase tracking-wider text-faint">Demo user</p>
            <p className="mt-0.5 text-xs text-muted">Recorded as the actor on every audit event.</p>
          </div>
          <div className="py-1">
            {users.map((option) => (
              <form key={option.id} action={switchDemoUser}>
                <input type="hidden" name="userId" value={option.id} />
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-panel-hover"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-overlay-2 text-[10px] font-semibold uppercase text-muted">
                    {initials(option.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{option.name}</span>
                    <span className="block truncate text-2xs text-faint">{option.email}</span>
                  </span>
                  {option.id === user.id ? <IconCheck className="h-3.5 w-3.5 text-accent" /> : null}
                </button>
              </form>
            ))}
          </div>

          <div className="border-t border-line px-3 py-2.5">
            <p className="text-2xs font-medium uppercase tracking-wider text-faint">View as</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-panel p-1">
              {ROLES.map((option) => (
                <form key={option} action={switchRole}>
                  <input type="hidden" name="role" value={option} />
                  <button
                    type="submit"
                    role="menuitemradio"
                    aria-checked={option === role}
                    className={`w-full rounded-md px-2 py-1 text-xs transition-colors ${
                      option === role
                        ? "bg-fg font-medium text-on-fg"
                        : "text-muted hover:bg-panel-hover hover:text-fg"
                    }`}
                  >
                    {ROLE_LABELS[option]}
                  </button>
                </form>
              ))}
            </div>
            <ul className="mt-2.5 space-y-1">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-1.5 text-2xs text-faint">
                  <IconCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                  <span className="capitalize">{PERMISSION_LABELS[permission]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-2xs text-faint">
              <IconLock className="h-3 w-3" />
              Prototype identity — enforcement runs server-side.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
