"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isRole } from "./rbac";
import { isDemoUserId, ROLE_COOKIE, USER_COOKIE } from "./session";

const COOKIE_OPTIONS = { path: "/", httpOnly: true, sameSite: "lax" } as const;

/** Prototype-only "View as" switch; replaced by SSO in a real deployment. */
export async function switchRole(formData: FormData): Promise<void> {
  const role = formData.get("role");
  if (!isRole(role)) return;

  cookies().set(ROLE_COOKIE, role, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}

/** Prototype-only identity switch, independent of the simulated role. */
export async function switchDemoUser(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (!isDemoUserId(userId)) return;

  cookies().set(USER_COOKIE, userId, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}
