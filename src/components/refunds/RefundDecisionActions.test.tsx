import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { cleanupRendered, renderComponent } from "@/test/render";
import { RefundDecisionActions } from "./RefundDecisionActions";

type ActionState = { ok: boolean; error: string | null };

const submitRefundDecision = vi.hoisted(() =>
  vi.fn<(state: ActionState, formData: FormData) => Promise<ActionState>>(async () => ({
    ok: false,
    error: null,
  })),
);

vi.mock("@/lib/refunds/actions", () => ({ submitRefundDecision }));

const BASE_PROPS = {
  refundId: "RFD-4101",
  customerName: "Priya Raghavan",
  merchant: "Lumen Grocers",
  transactionId: "TXN-88213",
  amount: "$182.40",
  statusLabel: "Pending",
};

function submittedReason(): string | null {
  const formData = submitRefundDecision.mock.calls.at(-1)?.[1] as FormData | undefined;
  const reason = formData?.get("reason");
  return typeof reason === "string" ? reason : null;
}

describe("RefundDecisionActions", () => {
  beforeEach(() => {
    submitRefundDecision.mockClear();
  });

  afterEach(() => {
    cleanupRendered();
  });

  it("confirms an approval with the customer, transaction and amount", async () => {
    const user = userEvent.setup();
    renderComponent(<RefundDecisionActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Approve refund" }));

    expect(submitRefundDecision).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Approve refund");
    expect(dialog).toHaveTextContent("Priya Raghavan");
    expect(dialog).toHaveTextContent("Lumen Grocers · TXN-88213");
    expect(dialog).toHaveTextContent("$182.40");
    expect(dialog).toHaveTextContent("Pending");
    expect(dialog).toHaveTextContent("Approved");

    await user.click(screen.getByRole("button", { name: "Confirm approval" }));
    expect(submitRefundDecision).toHaveBeenCalledTimes(1);
  });

  it("refuses to submit a denial without a reason", async () => {
    const user = userEvent.setup();
    renderComponent(<RefundDecisionActions {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Deny refund" }));
    await user.type(screen.getByLabelText("Reason (required)"), "   ");
    await user.click(screen.getByRole("button", { name: "Confirm denial" }));

    expect(submitRefundDecision).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A reason is required before a refund can be denied.",
    );

    await user.clear(screen.getByLabelText("Reason (required)"));
    await user.type(
      screen.getByLabelText("Reason (required)"),
      "Merchant provided proof of delivery.",
    );
    await user.click(screen.getByRole("button", { name: "Confirm denial" }));

    expect(submitRefundDecision).toHaveBeenCalledTimes(1);
    expect(submittedReason()).toBe("Merchant provided proof of delivery.");
  });

  it("hides approval and explains the high-value control", () => {
    renderComponent(
      <RefundDecisionActions
        {...BASE_PROPS}
        approveBlockedMessage="Refunds of $500.00 or more need Admin approval."
      />,
    );

    expect(
      screen.getByText("Refunds of $500.00 or more need Admin approval."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve refund" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny refund" })).toBeInTheDocument();
  });

  it("offers no decision at all to a role that cannot decide", () => {
    renderComponent(
      <RefundDecisionActions
        {...BASE_PROPS}
        approveBlockedMessage="Your role cannot decide refunds."
        denyBlockedMessage="Your role cannot decide refunds."
      />,
    );

    expect(screen.getByText("Your role cannot decide refunds.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deny refund" })).not.toBeInTheDocument();
  });

  it("shows the immutable notice once the refund is decided", () => {
    renderComponent(
      <RefundDecisionActions
        {...BASE_PROPS}
        disabledMessage="This refund was approved by Maya Chen and is immutable."
      />,
    );

    expect(
      screen.getByText("This refund was approved by Maya Chen and is immutable."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve refund" })).not.toBeInTheDocument();
  });
});
