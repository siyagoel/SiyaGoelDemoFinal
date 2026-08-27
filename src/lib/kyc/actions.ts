"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { decideApplication } from "./service";
import { ReviewError } from "./review";
import type { ReviewAction } from "./types";

export interface ReviewActionState {
  error: string | null;
  ok: boolean;
}

const ACTIONS: ReviewAction[] = ["approve", "reject", "escalate"];

function parseAction(value: FormDataEntryValue | null): ReviewAction {
  if (typeof value === "string" && (ACTIONS as string[]).includes(value)) {
    return value as ReviewAction;
  }
  throw new ReviewError("Unsupported review action.");
}

export async function submitReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = formData.get("reason");
  const user = getCurrentUser();

  try {
    const action = parseAction(formData.get("action"));
    decideApplication(user, applicationId, {
      action,
      reason: typeof reason === "string" ? reason : null,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ReviewError || error instanceof Error
          ? error.message
          : "Could not record the review action.",
    };
  }

  revalidatePath("/kyc");
  revalidatePath(`/kyc/${applicationId}`);
  return { ok: true, error: null };
}
