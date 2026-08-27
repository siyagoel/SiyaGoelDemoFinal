import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { cleanupRendered, renderComponent } from "@/test/render";
import { FlagControls } from "./FlagControls";
import type { FeatureFlag } from "@/lib/flags/types";

type ActionState = { ok: boolean; error: string | null };

const submitFlagChange = vi.hoisted(() =>
  vi.fn<(state: ActionState, formData: FormData) => Promise<ActionState>>(async () => ({
    ok: false,
    error: null,
  })),
);

vi.mock("@/lib/flags/actions", () => ({ submitFlagChange }));

function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: "instant-payouts:production",
    key: "instant-payouts",
    name: "Instant payouts",
    description: "Pay out balances immediately.",
    environment: "production",
    enabled: true,
    rolloutPercentage: 10,
    owner: "payments",
    updatedAt: "2024-05-17T03:00:00.000Z",
    ...overrides,
  };
}

const BASE_PROPS = {
  canManage: true,
  permissionMessage: "Your role cannot change feature flags.",
};

function submittedField(name: string): string | null {
  const formData = submitFlagChange.mock.calls.at(-1)?.[1] as FormData | undefined;
  const value = formData?.get(name);
  return typeof value === "string" ? value : null;
}

async function requestRollout(user: ReturnType<typeof userEvent.setup>, value: string) {
  const input = screen.getByLabelText("Rollout percentage");
  await user.clear(input);
  await user.type(input, value);
  await user.click(screen.getByRole("button", { name: "Update rollout" }));
}

describe("FlagControls guardrails", () => {
  beforeEach(() => {
    submitFlagChange.mockClear();
  });

  afterEach(() => {
    cleanupRendered();
  });

  it("confirms a production rollout change with before and after values", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await requestRollout(user, "50");

    expect(submitFlagChange).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "You are changing “Instant payouts” in Production from 10% rollout to 50%. Confirm this change?",
    );
    expect(dialog).toHaveTextContent("instant-payouts · Production");
    expect(dialog).toHaveTextContent("10% rollout");
    expect(dialog).toHaveTextContent("50% rollout");
    expect(dialog).toHaveTextContent("takes effect in Production immediately");
    expect(screen.getByLabelText("Reason (required)")).toBeInTheDocument();
    expect(screen.getByLabelText("Type instant-payouts to confirm")).toBeInTheDocument();
  });

  it("confirms enabling or disabling a production flag", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await user.click(screen.getByRole("button", { name: "Disable flag" }));

    expect(submitFlagChange).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Disable instant-payouts in Production");
    expect(dialog).toHaveTextContent("Enabled");
    expect(dialog).toHaveTextContent("Disabled");

    await user.type(screen.getByLabelText("Reason (required)"), "Incident 4412");
    await user.type(
      screen.getByLabelText("Type instant-payouts to confirm"),
      "instant-payouts",
    );
    await user.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(submittedField("action")).toBe("disable");
    expect(submittedField("confirmation")).toBe("instant-payouts");
  });

  it("refuses a production change until the flag key is typed back", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await requestRollout(user, "50");
    await user.type(screen.getByLabelText("Reason (required)"), "Ramping after load test");
    await user.type(screen.getByLabelText("Type instant-payouts to confirm"), "instant-payout");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(submitFlagChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Type “instant-payouts” to confirm this change.",
    );

    await user.type(screen.getByLabelText("Type instant-payouts to confirm"), "S");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(submitFlagChange).toHaveBeenCalledTimes(1);
  });

  it("requires a reason to roll a production flag out to 100%", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await requestRollout(user, "100");

    expect(screen.getByText("Increase Production rollout to 100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason (required)")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Reason (required)"), "   ");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(submitFlagChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A reason is required before this change can be submitted.",
    );

    await user.clear(screen.getByLabelText("Reason (required)"));
    await user.type(
      screen.getByLabelText("Reason (required)"),
      "Staged rollout completed with no elevated error rate.",
    );
    await user.type(
      screen.getByLabelText("Type instant-payouts to confirm"),
      "instant-payouts",
    );
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(submitFlagChange).toHaveBeenCalledTimes(1);
    expect(submittedField("rolloutPercentage")).toBe("100");
    expect(submittedField("reason")).toBe(
      "Staged rollout completed with no elevated error rate.",
    );
  });

  it("confirms a staging change without a reason or typed key", async () => {
    const user = userEvent.setup();
    renderComponent(
      <FlagControls
        {...BASE_PROPS}
        flag={makeFlag({ id: "instant-payouts:staging", environment: "staging" })}
      />,
    );

    await requestRollout(user, "100");

    expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Type instant-payouts to confirm"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm change" }));
    expect(submitFlagChange).toHaveBeenCalledTimes(1);
  });

  it("rejects an out-of-range rollout before asking for confirmation", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await requestRollout(user, "140");

    expect(submitFlagChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Rollout percentage must be a whole number between 0 and 100.",
    );
  });

  it("abandons the change on cancel", async () => {
    const user = userEvent.setup();
    renderComponent(<FlagControls {...BASE_PROPS} flag={makeFlag()} />);

    await requestRollout(user, "50");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(submitFlagChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Update rollout" })).toBeInTheDocument();
  });

  it("hides the controls and explains why for a role without flags:manage", () => {
    renderComponent(<FlagControls {...BASE_PROPS} canManage={false} flag={makeFlag()} />);

    expect(screen.getByText("Your role cannot change feature flags.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable flag" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rollout percentage")).not.toBeInTheDocument();
  });
});
