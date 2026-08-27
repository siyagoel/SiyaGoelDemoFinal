import { seedReferenceTime } from "@/lib/kyc/seed";
import { FLAG_ENVIRONMENTS, type FeatureFlag, type FlagEnvironment } from "./types";

interface FlagDefinition {
  key: string;
  name: string;
  description: string;
  owner: string;
  rollout: Record<FlagEnvironment, number>;
  enabled: Record<FlagEnvironment, boolean>;
}

const DEFINITIONS: FlagDefinition[] = [
  {
    key: "instant-payouts",
    name: "Minute-level merchant settlement",
    description:
      "Pays out from the pre-funded settlement account instead of waiting for the next banking window.",
    owner: "payments@northwind.example",
    rollout: { development: 100, staging: 100, production: 25 },
    enabled: { development: true, staging: true, production: true },
  },
  {
    key: "kyc-auto-approve",
    name: "Straight-through approval for clean applicants",
    description:
      "Clears applications scoring under 30 with no sanctions or PEP hits without a human reviewer.",
    owner: "compliance@northwind.example",
    rollout: { development: 100, staging: 50, production: 0 },
    enabled: { development: true, staging: true, production: false },
  },
  {
    key: "virtual-cards",
    name: "Single-use card issuance in-dashboard",
    description:
      "Customers mint a card number per merchant that expires after the first authorisation.",
    owner: "cards@northwind.example",
    rollout: { development: 100, staging: 100, production: 60 },
    enabled: { development: true, staging: true, production: true },
  },
  {
    key: "fx-multi-currency",
    name: "Hold and convert EUR/GBP balances",
    description:
      "Adds EUR and GBP wallets alongside USD, converting at mid-market plus a fixed spread.",
    owner: "treasury@northwind.example",
    rollout: { development: 100, staging: 75, production: 10 },
    enabled: { development: true, staging: true, production: false },
  },
  {
    key: "risk-model-v3",
    name: "Gradient-boosted transaction scoring",
    description:
      "Replaces the v2 rules engine with the gradient-boosted model for authorisation decisions.",
    owner: "risk@northwind.example",
    rollout: { development: 100, staging: 100, production: 5 },
    enabled: { development: true, staging: false, production: false },
  },
  {
    key: "statement-redesign",
    name: "Categorised spend on PDF statements",
    description:
      "Groups transactions by merchant category on the monthly PDF and adds a spend summary page.",
    owner: "growth@northwind.example",
    rollout: { development: 100, staging: 100, production: 100 },
    enabled: { development: true, staging: true, production: true },
  },
  {
    key: "sca-step-up",
    name: "Step-up auth on high-value transfers",
    description:
      "Sends a push challenge before transfers over $2,000 or to a payee added in the last 24 hours.",
    owner: "risk@northwind.example",
    rollout: { development: 100, staging: 40, production: 0 },
    enabled: { development: true, staging: true, production: false },
  },
  {
    key: "merchant-api-v2",
    name: "Partner access to the v2 merchant API",
    description:
      "Opens the v2 REST endpoints — idempotent payments and webhooks — to partner integrations.",
    owner: "platform@northwind.example",
    rollout: { development: 100, staging: 100, production: 35 },
    enabled: { development: true, staging: true, production: true },
  },
];

/** Hours since the reference time that each definition was last touched. */
const LAST_TOUCHED_HOURS = [6, 20, 34, 52, 96, 170, 340, 700];

export function createSeedFlags(baseTime = seedReferenceTime()): FeatureFlag[] {
  return DEFINITIONS.flatMap((definition, index) =>
    FLAG_ENVIRONMENTS.map((environment, envIndex) => ({
      id: `${definition.key}:${environment}`,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      environment,
      enabled: definition.enabled[environment],
      rolloutPercentage: definition.rollout[environment],
      owner: definition.owner,
      updatedAt: new Date(
        baseTime -
          (LAST_TOUCHED_HOURS[index % LAST_TOUCHED_HOURS.length] + envIndex * 5) * 3_600_000,
      ).toISOString(),
    })),
  );
}
