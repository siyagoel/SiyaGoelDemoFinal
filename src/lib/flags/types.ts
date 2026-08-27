export type FlagEnvironment = "development" | "staging" | "production";

export type FlagAction = "enable" | "disable" | "set_rollout";

export interface FeatureFlag {
  /** Unique per environment; the flag key is shared across environments. */
  id: string;
  key: string;
  name: string;
  description: string;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercentage: number;
  owner: string;
  updatedAt: string;
}

export const FLAG_ENVIRONMENTS: FlagEnvironment[] = [
  "development",
  "staging",
  "production",
];

export const ENVIRONMENT_LABELS: Record<FlagEnvironment, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};
