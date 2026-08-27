import { describe, expect, it } from "vitest";
import { fuzzyScore, groupCommands, rankCommands, type Command } from "./search";

const COMMANDS: Command[] = [
  { id: "kyc", group: "Pages", label: "KYC Review Queue", href: "/kyc" },
  { id: "flags", group: "Pages", label: "Feature Flags", href: "/flags" },
  { id: "audit", group: "Pages", label: "Audit Log", href: "/audit" },
  {
    id: "case",
    group: "KYC cases",
    label: "Priya Rossi",
    keywords: "KYC-1012 priya.rossi@example.com",
    href: "/kyc/KYC-1012",
  },
];

describe("fuzzyScore", () => {
  it("matches subsequences and rejects missing characters", () => {
    expect(fuzzyScore("frq", "Feature Rollout Queue")).not.toBeNull();
    expect(fuzzyScore("zz", "Feature Flags")).toBeNull();
    expect(fuzzyScore("feature flags!", "Feature Flags")).toBeNull();
  });

  it("scores an empty query as neutral", () => {
    expect(fuzzyScore("   ", "Anything")).toBe(0);
  });

  it("prefers prefixes over matches later in the string", () => {
    const prefix = fuzzyScore("aud", "Audit Log");
    const middle = fuzzyScore("aud", "Review audit");

    expect(prefix).toBeGreaterThan(middle as number);
  });

  it("prefers word starts over mid-word matches", () => {
    const wordStart = fuzzyScore("fl", "Feature Flags");
    const midWord = fuzzyScore("fl", "Backfill queue");

    expect(wordStart).toBeGreaterThan(midWord as number);
  });

  it("rewards contiguous runs", () => {
    const contiguous = fuzzyScore("queue", "Review Queue");
    const scattered = fuzzyScore("qeu", "Review Queue");

    expect(contiguous).toBeGreaterThan(scattered as number);
  });
});

describe("rankCommands", () => {
  it("returns everything, unranked, for an empty query", () => {
    const ranked = rankCommands("", COMMANDS);

    expect(ranked).toHaveLength(4);
    expect(ranked.every((command) => command.score === 0)).toBe(true);
  });

  it("puts the best match first and drops non-matches", () => {
    const ranked = rankCommands("flag", COMMANDS);

    expect(ranked[0].id).toBe("flags");
    expect(ranked.map((command) => command.id)).not.toContain("audit");
  });

  it("matches on keywords a user would type but cannot see in the label", () => {
    const ranked = rankCommands("KYC-1012", COMMANDS);

    expect(ranked[0].id).toBe("case");
  });

  it("ranks a label match above the same match in keywords", () => {
    const label: Command = { id: "a", group: "g", label: "rollout", href: "/a" };
    const keyword: Command = { id: "b", group: "g", label: "unrelated", keywords: "rollout", href: "/b" };

    expect(rankCommands("rollout", [keyword, label])[0].id).toBe("a");
  });

  it("respects the result limit", () => {
    expect(rankCommands("", COMMANDS, 2)).toHaveLength(2);
    expect(rankCommands("a", COMMANDS, 1)).toHaveLength(1);
  });
});

describe("groupCommands", () => {
  it("buckets results by group, keeping rank order", () => {
    const grouped = groupCommands(rankCommands("", COMMANDS));

    expect(grouped.map(([group]) => group)).toEqual(["Pages", "KYC cases"]);
    expect(grouped[0][1]).toHaveLength(3);
  });
});
