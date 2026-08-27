"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { FlagError } from "./mutations";
import { changeFlag } from "./service";
import type { FlagAction } from "./types";

export interface FlagActionState {
  error: string | null;
  ok: boolean;
}

const ACTIONS: FlagAction[] = ["enable", "disable", "set_rollout"];

function parseAction(value: FormDataEntryValue | null): FlagAction {
  if (typeof value === "string" && (ACTIONS as string[]).includes(value)) {
    return value as FlagAction;
  }
  throw new FlagError("Unsupported flag action.");
}

export async function submitFlagChange(
  _prevState: FlagActionState,
  formData: FormData,
): Promise<FlagActionState> {
  const flagId = String(formData.get("flagId") ?? "");
  const rollout = formData.get("rolloutPercentage");
  const reason = formData.get("reason");
  const confirmation = formData.get("confirmation");
  const user = getCurrentUser();

  try {
    const action = parseAction(formData.get("action"));
    changeFlag(user, flagId, {
      action,
      rolloutPercentage:
        typeof rollout === "string" && rollout !== "" ? Number(rollout) : undefined,
      reason: typeof reason === "string" ? reason : null,
      confirmation: typeof confirmation === "string" ? confirmation : null,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not apply the flag change.",
    };
  }

  revalidatePath("/flags");
  revalidatePath(`/flags/${flagId}`);
  return { ok: true, error: null };
}
