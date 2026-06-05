import type { ConnectSourceTextQuality } from "$lib/server/connect/connect-source-text-resolve";

export const MIN_SOURCE_MATCH_SCORE = 32;

export function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score how well an idea's wording appears in a source body (higher = stronger match). */
export function scoreIdeaSourceMatch(ideaText: string, sourceText: string): number {
  const idea = normalizeMatchText(ideaText);
  const source = normalizeMatchText(sourceText);
  if (!idea || !source) return 0;
  if (source.includes(idea)) return idea.length + 50;

  const words = idea.split(" ").filter((w) => w.length > 2);
  if (words.length < 4) {
    return source.includes(idea) ? idea.length : 0;
  }

  for (let len = Math.min(words.length, 14); len >= 4; len -= 1) {
    for (let start = 0; start <= words.length - len; start += 1) {
      const phrase = words.slice(start, start + len).join(" ");
      if (phrase.length >= MIN_SOURCE_MATCH_SCORE && source.includes(phrase)) {
        return phrase.length;
      }
    }
  }
  return 0;
}

export function isLegacyGraphSource(args: {
  sourceKind: string | null;
  sourceTitle: string | null;
}): boolean {
  if (args.sourceKind === "legacy") return true;
  const title = args.sourceTitle?.trim().toLowerCase() ?? "";
  return (
    title.includes("legacy ideas") ||
    title.includes("source not recorded") ||
    title === "untitled"
  );
}

export function unitNeedsSourceLink(args: {
  sourceKind: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  resolvedQuality: ConnectSourceTextQuality;
}): boolean {
  if (isLegacyGraphSource(args)) return true;
  if (args.resolvedQuality === "missing") return true;
  if (
    !args.sourceTitle?.trim() &&
    !args.sourceUrl?.trim() &&
    args.resolvedQuality !== "full"
  ) {
    return true;
  }
  return false;
}

export function pickBestSourceMatch<T extends { graphSourceId: string }>(
  ideaText: string,
  candidates: (T & { text: string })[],
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreIdeaSourceMatch(ideaText, candidate.text);
    if (score < MIN_SOURCE_MATCH_SCORE) continue;
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }
  return best;
}
