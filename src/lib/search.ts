/**
 * Ranking for the command palette. Pure so the matching rules are testable
 * without mounting the palette.
 */

export interface Command {
  id: string;
  group: string;
  label: string;
  /** Extra text that should match but is not part of the label. */
  keywords?: string;
  hint?: string;
  href: string;
}

export interface RankedCommand extends Command {
  score: number;
}

/**
 * Subsequence match with bonuses for contiguity, word starts and prefixes.
 * Returns null when a character of the query is missing from the target.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const needle = query.trim().toLowerCase();
  const haystack = target.toLowerCase();
  if (needle === "") return 0;
  if (needle.length > haystack.length) return null;

  let score = 0;
  let cursor = 0;
  let streak = 0;

  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return null;

    if (index === cursor && cursor > 0) {
      streak += 1;
      score += 6 + streak * 2;
    } else {
      streak = 0;
      score += 1;
    }

    const previous = index > 0 ? haystack[index - 1] : "";
    if (index === 0) score += 12;
    else if (previous === " " || previous === "-" || previous === "_" || previous === ".") score += 8;

    cursor = index + 1;
  }

  // Prefer shorter targets so exact-ish matches outrank long descriptions.
  return score - Math.floor(haystack.length / 12);
}

export function rankCommands(query: string, commands: Command[], limit = 12): RankedCommand[] {
  const trimmed = query.trim();
  if (trimmed === "") {
    return commands.slice(0, limit).map((command) => ({ ...command, score: 0 }));
  }

  return commands
    .map((command) => {
      const label = fuzzyScore(trimmed, command.label);
      const keywords = command.keywords ? fuzzyScore(trimmed, command.keywords) : null;
      const best =
        label === null ? keywords : keywords === null ? label : Math.max(label, keywords - 4);
      return best === null ? null : { ...command, score: best };
    })
    .filter((command): command is RankedCommand => command !== null)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function groupCommands(commands: RankedCommand[]): [string, RankedCommand[]][] {
  const groups = new Map<string, RankedCommand[]>();
  for (const command of commands) {
    const bucket = groups.get(command.group);
    if (bucket) bucket.push(command);
    else groups.set(command.group, [command]);
  }
  return Array.from(groups.entries());
}
