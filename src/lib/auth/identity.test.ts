import { beforeEach, describe, expect, it } from "vitest";
import { ReviewError } from "@/lib/kyc/review";
import { decideApplication } from "@/lib/kyc/service";
import { getApplication, listApplications, listAuditEvents, resetStore } from "@/lib/kyc/store";
import { asAuthUser, demoUserById, DEMO_USERS } from "./session";

const MAYA = demoUserById("maya.chen");
const JORDAN = demoUserById("jordan.patel");
const ALEX = demoUserById("alex.thompson");

function pendingLowRiskApplication() {
  const application = listApplications({ status: "pending" }).find(
    (candidate) => candidate.riskLevel !== "high",
  );
  if (!application) throw new Error("seed data has no pending standard-risk application");
  return application;
}

beforeEach(() => {
  resetStore();
});

describe("demo user identity", () => {
  it("exposes the predefined demo users and falls back to the default", () => {
    expect(DEMO_USERS.map((user) => user.email)).toEqual([
      "sam.rivera@fintech-demo.com",
      "maya.chen@fintech-demo.com",
      "jordan.patel@fintech-demo.com",
      "alex.thompson@fintech-demo.com",
    ]);
    expect(demoUserById("unknown-person").email).toBe("sam.rivera@fintech-demo.com");
  });

  it("changes identity independently from the simulated role", () => {
    expect(asAuthUser(MAYA, "reviewer")).toEqual({
      name: "Maya Chen",
      email: "maya.chen@fintech-demo.com",
      role: "reviewer",
    });
    // Same person, different simulated role.
    expect(asAuthUser(MAYA, "admin").email).toBe(MAYA.email);
    // Same simulated role, different person.
    expect(asAuthUser(JORDAN, "reviewer").role).toBe("reviewer");
    expect(asAuthUser(JORDAN, "reviewer").name).toBe("Jordan Patel");
  });

  it("records the selected user's name, email and role on audit events", () => {
    const target = pendingLowRiskApplication();

    const { event } = decideApplication(asAuthUser(MAYA, "reviewer"), target.id, {
      action: "escalate",
      reason: "Needs a second pair of eyes",
    });

    expect(event.actorName).toBe("Maya Chen");
    expect(event.actor).toBe("maya.chen@fintech-demo.com");
    expect(event.actorRole).toBe("reviewer");
  });
});

describe("kyc separation of duties at the service layer", () => {
  function escalatedApplicationId(): string {
    const target = pendingLowRiskApplication();
    decideApplication(asAuthUser(MAYA, "reviewer"), target.id, {
      action: "escalate",
      reason: "Needs a second pair of eyes",
    });
    return target.id;
  }

  it("refuses an approval by the user who escalated the case", () => {
    const id = escalatedApplicationId();

    expect(() =>
      decideApplication(asAuthUser(MAYA, "reviewer"), id, { action: "approve" }),
    ).toThrow(ReviewError);
    expect(getApplication(id)?.status).toBe("escalated");
    expect(listAuditEvents(id)).toHaveLength(1);
  });

  it("refuses a rejection by the user who escalated the case, whatever role they view as", () => {
    const id = escalatedApplicationId();

    expect(() =>
      decideApplication(asAuthUser(MAYA, "admin"), id, {
        action: "reject",
        reason: "Documents forged",
      }),
    ).toThrow(/different reviewer/);
    expect(getApplication(id)?.status).toBe("escalated");
    expect(listAuditEvents(id)).toHaveLength(1);
  });

  it("lets a different reviewer approve the escalated case", () => {
    const id = escalatedApplicationId();

    decideApplication(asAuthUser(JORDAN, "reviewer"), id, { action: "approve" });

    expect(getApplication(id)?.status).toBe("approved");
  });

  it("lets a different admin reject the escalated case", () => {
    const id = escalatedApplicationId();

    const { event } = decideApplication(asAuthUser(ALEX, "admin"), id, {
      action: "reject",
      reason: "Sanctions hit confirmed",
    });

    expect(getApplication(id)?.status).toBe("rejected");
    expect(event.actorName).toBe("Alex Thompson");
    expect(event.actorRole).toBe("admin");
  });
});
