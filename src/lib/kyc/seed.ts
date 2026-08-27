import type { KycApplication, RiskLevel, ReviewStatus } from "./types";

const FIRST_NAMES = [
  "Amara",
  "Blake",
  "Chen",
  "Dmitri",
  "Elena",
  "Farid",
  "Grace",
  "Hana",
  "Ivan",
  "Julia",
  "Karim",
  "Lena",
  "Mateo",
  "Nadia",
  "Oscar",
  "Priya",
  "Quinn",
  "Rosa",
  "Sven",
  "Tara",
  "Umar",
  "Vera",
  "Wei",
  "Yara",
];

const LAST_NAMES = [
  "Okafor",
  "Nguyen",
  "Silva",
  "Petrov",
  "Kowalski",
  "Haddad",
  "Larsen",
  "Tanaka",
  "Moreau",
  "Rossi",
  "Fernandez",
  "Novak",
  "Bergman",
  "Cohen",
  "Duarte",
  "Ivanova",
];

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Germany",
  "Singapore",
  "Brazil",
  "Nigeria",
  "India",
  "Japan",
  "Poland",
  "Mexico",
];

const FLAGS = [
  "Sanctions list near-match",
  "PEP match",
  "Address mismatch",
  "Document expired soon",
  "Device fingerprint reused",
  "High-risk jurisdiction",
  "Velocity: multiple signups",
  "Selfie liveness low confidence",
];

const DOCUMENT_TYPES = [
  "passport",
  "drivers_license",
  "national_id",
  "proof_of_address",
] as const;

/** Deterministic PRNG so the seeded queue is identical on every boot. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Reference point for the seeded queue: the start of the current UTC day, so
 * the demo data is always recent while staying identical within a given day.
 */
export function seedReferenceTime(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0);
}

export function createSeedApplications(
  count = 28,
  baseTime = seedReferenceTime(),
): KycApplication[] {
  const random = createRandom(20240517);
  const applications: KycApplication[] = [];

  for (let index = 0; index < count; index += 1) {
    const pick = <T,>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)];

    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const riskScore = Math.floor(random() * 100);
    const riskLevel = riskLevelFromScore(riskScore);
    const submittedAt = new Date(
      baseTime - Math.floor(random() * 12) * 86_400_000 - index * 3_600_000,
    ).toISOString();

    const flagCount = riskLevel === "high" ? 2 : riskLevel === "medium" ? 1 : 0;
    const flags: string[] = [];
    while (flags.length < flagCount) {
      const flag = pick(FLAGS);
      if (!flags.includes(flag)) flags.push(flag);
    }

    const statusRoll = random();
    const status: ReviewStatus = statusRoll > 0.85 ? "escalated" : "pending";

    const documents = DOCUMENT_TYPES.slice(0, 2 + Math.floor(random() * 3)).map(
      (type, docIndex) => ({
        type,
        reference: `DOC-${1000 + index * 10 + docIndex}`,
        uploadedAt: submittedAt,
      }),
    );

    applications.push({
      id: `KYC-${(1001 + index).toString()}`,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      country: pick(COUNTRIES),
      dateOfBirth: new Date(
        Date.UTC(1965 + Math.floor(random() * 35), Math.floor(random() * 12), 1 + Math.floor(random() * 27)),
      )
        .toISOString()
        .slice(0, 10),
      submittedAt,
      riskLevel,
      riskScore,
      status,
      flags,
      documents,
      decidedAt: null,
      decisionReason: null,
    });
  }

  return applications;
}
