import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { cleanupRendered, renderComponent } from "@/test/render";
import { ReviewActions } from "./ReviewActions";

type ActionState = { ok: boolean; error: string | null };

const submitReviewAction = vi.hoisted(() =>
  vi.fn<(state: ActionState, formData: FormData) => Promise<ActionState>>(async () => ({
    ok: false,
    error: null,
  })),
);

vi.mock("@/lib/kyc/actions", () => ({ submitReviewAction }));

const BASE_PROPS = {
  applicationId: "KYC-1012",
  applicantName: "Priya Rossi",
  canDecide: true,
  permissionMessage: "Your role cannot decide KYC cases.",
  disabled: false,
  canEscalate: true,
  canApprove: true,
  canReject: true,
  noteRequiredToApprove: false,
};

function submittedReason(): string | null {
  const formData = submitReviewAction.mock.calls.at(-1)?.[1] as FormData | undefined;
  const reason = formData?.get("reason");
  return typeof reason === "string" ? reason : null;
}

describe("ReviewActions guardrails", () => {
  beforeEach(() => {
    submitReviewAction.mockClear();
  });

  afterEach(() => {
    cleanupRendered();
  });

  it("asks for confirmation instead of rejecting immediately", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(submitReviewAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Reject KYC case");
    expect(dialog).toHaveTextContent("Priya Rossi · KYC-1012");
    expect(dialog).toHaveTextContent("Rejecting is final");
    expect(screen.getByLabelText("Reason (required)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm reject" })).toBeInTheDocument();
  });

  it("focuses the reason field and closes the dialog on Escape", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    const trigger = screen.getByRole("button", { name: "Escalate" });
    await user.click(trigger);
    expect(screen.getByLabelText("Reason (required)")).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitReviewAction).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("blocks a rejection with a whitespace-only reason", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByLabelText("Reason (required)"), "   ");
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));

    expect(submitReviewAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A reason is required before this action can be submitted.",
    );
  });

  it("submits the rejection reason once one is entered", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(
      screen.getByLabelText("Reason (required)"),
      "Identity document could not be verified.",
    );
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));

    expect(submitReviewAction).toHaveBeenCalledTimes(1);
    expect(submittedReason()).toBe("Identity document could not be verified.");
  });

  it("requires a reason to escalate", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Escalate" }));
    expect(screen.getByLabelText("Reason (required)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm escalate" }));
    expect(submitReviewAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Reason (required)"), "Sanctions screening hit.");
    await user.click(screen.getByRole("button", { name: "Confirm escalate" }));
    expect(submittedReason()).toBe("Sanctions screening hit.");
  });

  it("requires a reviewer note to approve a high-risk case but not a low-risk one", async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent(
      <ReviewActions {...BASE_PROPS} noteRequiredToApprove={true} />,
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByLabelText("Reason (required)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm approve" }));
    expect(submitReviewAction).not.toHaveBeenCalled();
    unmount();

    renderComponent(<ReviewActions {...BASE_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm approve" }));
    expect(submitReviewAction).toHaveBeenCalledTimes(1);
  });

  it("abandons the action on cancel", async () => {
    const user = userEvent.setup();
    renderComponent(<ReviewActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(submitReviewAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides the controls and explains why when the role cannot decide", () => {
    renderComponent(<ReviewActions {...BASE_PROPS} canDecide={false} />);

    expect(screen.getByText("Your role cannot decide KYC cases.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("explains the separation-of-duties block on the escalated case", () => {
    renderComponent(
      <ReviewActions
        {...BASE_PROPS}
        canApprove={false}
        canReject={false}
        canEscalate={false}
        decisionBlockedMessage="You escalated this case. A different reviewer must make the final decision."
      />,
    );

    expect(
      screen.getByText(
        "You escalated this case. A different reviewer must make the final decision.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
