import { deniedMessage, type Permission, type Role } from "@/lib/auth/rbac";
import { IconLock } from "@/components/ui/icons";

/** Shown by a page when the acting role lacks the permission the tool requires. */
export function AccessDenied({ role, permission }: { role: Role; permission: Permission }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[rgba(251,191,36,0.24)] bg-[var(--warning-soft)] px-4 py-3.5">
      <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-medium text-warning">No access</p>
        <p className="mt-1 text-sm text-muted">{deniedMessage(role, permission)}</p>
        <p className="mt-2 text-xs text-faint">
          Switch the simulated role from the menu in the top right to continue.
        </p>
      </div>
    </div>
  );
}
