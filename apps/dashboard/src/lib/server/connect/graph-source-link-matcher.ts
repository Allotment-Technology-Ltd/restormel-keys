import type { ConnectSourceTextQuality } from "$lib/server/connect/connect-source-text-resolve";

export const MIN_SOURCE_MATCH_SCORE = 32;
/** Cap source bodies used for substring matching — passage aggregates can be huge. */
export const MAX_SOURCE_MATCH_CHARS = 80_000;

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

/**
 * Whether an idea still needs its `source` edge assigned via text matching.
 *
 * BYO Surreal graphs (e.g. SOPHIA) usually already store `idea.source → source` and
 * full text on `source` or linked `passage` rows. That is graph-native provenance —
 * Keys resolves it at validation time; we must not re-scan 30k+ ideas to guess a link.
 *
 * Text matching is only for: no source edge, or a legacy placeholder source record.
 */
export function unitNeedsSourceLink(args: {
  sourceKind: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  /** Surreal record id when the unit already points at a bibliographic source. */
  sourceKey?: string | null;
  resolvedQuality: ConnectSourceTextQuality;
}): boolean {
  if (isLegacyGraphSource(args)) return true;
  if (args.sourceKey?.includes(":")) return false;
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

export type PreparedMatchCandidate<T> = T & { text: string; normalizedText: string };

/** Pre-normalize catalog bodies once — avoids re-tokenizing 200+ sources per idea. */
function clipTextForMatching(text: string): string {
  if (text.length <= MAX_SOURCE_MATCH_CHARS) return text;
  return text.slice(0, MAX_SOURCE_MATCH_CHARS);
}

export function prepareSourceMatchCandidates<T extends { text: string }>(
  candidates: T[],
): PreparedMatchCandidate<T>[] {
  return candidates.map((candidate) => ({
    ...candidate,
    normalizedText: normalizeMatchText(clipTextForMatching(candidate.text)),
  }));
}

function scoreNormalizedIdeaAgainstSource(
  ideaNorm: string,
  sourceNorm: string,
  ideaRaw: string,
): number {
  if (!ideaNorm || !sourceNorm) return 0;
  if (sourceNorm.includes(ideaNorm)) return ideaNorm.length + 50;

  const words = ideaNorm.split(" ").filter((w) => w.length > 2);
  if (words.length < 4) {
    return sourceNorm.includes(ideaNorm) ? ideaRaw.trim().length : 0;
  }

  for (let len = Math.min(words.length, 14); len >= 4; len -= 1) {
    for (let start = 0; start <= words.length - len; start += 1) {
      const phrase = words.slice(start, start + len).join(" ");
      if (phrase.length >= MIN_SOURCE_MATCH_SCORE && sourceNorm.includes(phrase)) {
        return phrase.length;
      }
    }
  }
  return 0;
}

export function pickBestSourceMatch<T extends { graphSourceId: string }>(
  ideaText: string,
  candidates: (T & { text: string })[],
): { candidate: T; score: number } | null {
  const ideaNorm = normalizeMatchText(ideaText);
  if (!ideaNorm) return null;
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreNormalizedIdeaAgainstSource(
      ideaNorm,
      normalizeMatchText(candidate.text),
      ideaText,
    );
    if (score < MIN_SOURCE_MATCH_SCORE) continue;
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }
  return best;
}

export function pickBestPreparedSourceMatch<T extends { graphSourceId: string }>(
  ideaText: string,
  candidates: PreparedMatchCandidate<T>[],
): { candidate: T; score: number } | null {
  const ideaNorm = normalizeMatchText(ideaText);
  if (!ideaNorm) return null;
  const perfectScore = ideaNorm.length + 50;
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreNormalizedIdeaAgainstSource(
      ideaNorm,
      candidate.normalizedText,
      ideaText,
    );
    if (score < MIN_SOURCE_MATCH_SCORE) continue;
    if (!best || score > best.score) {
      best = { candidate, score };
      if (score >= perfectScore) break;
    }
  }
  return best;
}

/** Fast provenance quality from fields already on the unit row (no pipeline DB round-trips). */
export function inferSourceTextQualityForLink(args: {
  textPreview: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceInlineText?: string | null;
}): ConnectSourceTextQuality {
  if (args.sourceInlineText?.trim()) return "full";
  if (args.textPreview?.trim()) return "preview";
  if (args.sourceTitle?.trim() || args.sourceUrl?.trim()) return "preview";
  return "missing";
}
