/**
 * Shared authorization model for every internal tool.
 *
 * A tool declares the permissions it needs here, roles are granted sets of
 * permissions, and services call `assertPermission` before mutating state.
 * Adding a tool means adding permissions and listing them on the roles that
 * should have them — no per-page role checks anywhere in the app.
 */

export type Role = "reviewer" | "engineer" | "admin";

export type Permission =
  | "kyc:view"
  | "kyc:decide"
  | "flags:view"
  | "flags:manage"
  | "refunds:view"
  | "refunds:decide"
  | "refunds:decide_high_value"
  | "audit:view";

export interface AuthUser {
  name: string;
  email: string;
  role: Role;
}

export const ROLES: Role[] = ["reviewer", "engineer", "admin"];

export const ROLE_LABELS: Record<Role, string> = {
  reviewer: "Reviewer",
  engineer: "Engineer",
  admin: "Admin",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "kyc:view": "view KYC cases",
  "kyc:decide": "approve, reject or escalate KYC cases",
  "flags:view": "view feature flags",
  "flags:manage": "change feature flags",
  "refunds:view": "view refund requests",
  "refunds:decide": "approve or deny refunds",
  "refunds:decide_high_value": "decide high-value refunds",
  "audit:view": "view the platform audit log",
};

const REVIEWER_PERMISSIONS: Permission[] = [
  "kyc:view",
  "kyc:decide",
  "flags:view",
  "refunds:view",
  "refunds:decide",
  "audit:view",
];
const ENGINEER_PERMISSIONS: Permission[] = [
  "kyc:view",
  "flags:view",
  "flags:manage",
  "refunds:view",
  "audit:view",
];
/** Only an admin carries the elevated grants, e.g. high-value refund decisions. */
const ADMIN_ONLY_PERMISSIONS: Permission[] = ["refunds:decide_high_value"];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  reviewer: REVIEWER_PERMISSIONS,
  engineer: ENGINEER_PERMISSIONS,
  admin: Array.from(
    new Set([...REVIEWER_PERMISSIONS, ...ENGINEER_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS]),
  ),
};

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Message shown in the UI (and returned by rejected mutations). */
export function deniedMessage(role: Role, permission: Permission): string {
  return `Your role (${ROLE_LABELS[role]}) is not allowed to ${PERMISSION_LABELS[permission]}.`;
}

export function assertPermission(user: AuthUser, permission: Permission): void {
  if (!can(user.role, permission)) {
    throw new AuthorizationError(deniedMessage(user.role, permission));
  }
}
