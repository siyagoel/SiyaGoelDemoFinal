"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { RefundError } from "./mutations";
import { decideRefund } from "./service";
import type { RefundDecision } from "./types";

export interface RefundActionState {
  error: string | null;
  ok: boolean;
}

const DECISIONS: RefundDecision[] = ["approve", "deny"];

function parseDecision(value: FormDataEntryValue | null): RefundDecision {
  if (typeof value === "string" && (DECISIONS as string[]).includes(value)) {
    return value as RefundDecision;
  }
  throw new RefundError("Unsupported refund decision.");
}

export async function submitRefundDecision(
  _prevState: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const refundId = String(formData.get("refundId") ?? "");
  const reason = formData.get("reason");
  const user = getCurrentUser();

  try {
    const decision = parseDecision(formData.get("decision"));
    decideRefund(user, refundId, {
      decision,
      reason: typeof reason === "string" ? reason : null,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not record the refund decision.",
    };
  }

  revalidatePath("/refunds");
  revalidatePath(`/refunds/${refundId}`);
  revalidatePath("/");
  return { ok: true, error: null };
}
