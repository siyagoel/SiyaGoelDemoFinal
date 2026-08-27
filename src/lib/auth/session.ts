import { cookies } from "next/headers";
import { isRole, ROLE_LABELS, type AuthUser, type Role } from "./rbac";

export const ROLE_COOKIE = "northwind-view-as";
export const USER_COOKIE = "northwind-demo-user";

const DEFAULT_ROLE: Role = "reviewer";

/** Identity of the person performing an action, independent of their role. */
export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Prototype directory of users. A production deployment replaces
 * `getCurrentUser` with an SSO session lookup; everything downstream only
 * depends on the `AuthUser` shape.
 */
export const DEMO_USERS: DemoUser[] = [
  { id: "sam.rivera", name: "Sam Rivera", email: "sam.rivera@fintech-demo.com" },
  { id: "maya.chen", name: "Maya Chen", email: "maya.chen@fintech-demo.com" },
  { id: "jordan.patel", name: "Jordan Patel", email: "jordan.patel@fintech-demo.com" },
  { id: "alex.thompson", name: "Alex Thompson", email: "alex.thompson@fintech-demo.com" },
];

const DEFAULT_DEMO_USER = DEMO_USERS[0];

export function isDemoUserId(value: unknown): value is string {
  return typeof value === "string" && DEMO_USERS.some((user) => user.id === value);
}

export function demoUserById(id: string | undefined): DemoUser {
  return DEMO_USERS.find((user) => user.id === id) ?? DEFAULT_DEMO_USER;
}

/** Combines the selected identity with the simulated role. */
export function asAuthUser(user: DemoUser, role: Role): AuthUser {
  return { name: user.name, email: user.email, role };
}

export function getCurrentDemoUser(): DemoUser {
  return demoUserById(cookies().get(USER_COOKIE)?.value);
}

export function getCurrentRole(): Role {
  const selected = cookies().get(ROLE_COOKIE)?.value;
  return isRole(selected) ? selected : DEFAULT_ROLE;
}

export function getCurrentUser(): AuthUser {
  return asAuthUser(getCurrentDemoUser(), getCurrentRole());
}

export function roleLabel(user: AuthUser): string {
  return ROLE_LABELS[user.role];
}
