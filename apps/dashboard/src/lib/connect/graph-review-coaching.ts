import { graphReviewGuidance } from "$lib/connect/graph-review-guidance";
import {
  hasHumanReviewNote,
  normalizeValidationStatus,
  type KnownValidationStatus,
} from "$lib/connect/validation-status";

export type GraphReviewCoachingSourceQuality = "full" | "preview" | "missing";

/** Same three beats for every human review — shown in the UI without an LLM call. */
export const GRAPH_REVIEW_COMMON_STEPS = [
  "Open the source and find the passage behind this claim.",
  "Compare wording — scope, certainty, and attribution.",
  "Confirm the AI verdict or override with the button that fits.",
] as const;

export type GraphReviewCoaching = {
  /** One-line idea-specific angle (from AI validation note or a light LLM pass). */
  focus: string;
  /** Up to two source-specific things to verify for this idea only. */
  lookFor: string[];
  sourceQuality: GraphReviewCoachingSourceQuality;
  generatedBy: "llm" | "note" | "fallback";
};

const MAX_FOCUS_CHARS = 200;
const MAX_LOOK_FOR = 2;
const SOURCE_EXCERPT_CHARS = 1_800;

export function verdictLookForHints(
  verdict: KnownValidationStatus | "unchecked",
  sourceQuality: GraphReviewCoachingSourceQuality,
): string[] {
  const hints: string[] = [];
  if (sourceQuality === "preview") {
    hints.push("Full source text may be needed — use the linked document.");
  } else if (sourceQuality === "missing") {
    hints.push("Source text is not linked — check Pipeline → Sources.");
  }
  if (verdict === "weak") {
    hints.push("Watch for overstated certainty or scope beyond the passage.");
  } else if (verdict === "unsupported") {
    hints.push("Look for missing or contradicting facts in the source.");
  } else if (verdict === "ok") {
    hints.push("Confirm this is a fair paraphrase, not an extra inference.");
  } else {
    hints.push("Decide whether the source actually supports this claim.");
  }
  return hints.slice(0, MAX_LOOK_FOR);
}

export function coachingFromAiValidationNote(args: {
  validationStatus: string | null;
  validationNote: string | null;
  sourceQuality: GraphReviewCoachingSourceQuality;
}): GraphReviewCoaching | null {
  const note = args.validationNote?.trim() ?? "";
  if (!note || hasHumanReviewNote(note)) return null;
  const verdict = normalizeValidationStatus(args.validationStatus);
  const tone =
    verdict === "ok" || verdict === "weak" || verdict === "unsupported" ? verdict : "unchecked";
  const focus =
    note.length > MAX_FOCUS_CHARS ? `${note.slice(0, MAX_FOCUS_CHARS - 1)}…` : note;
  return {
    focus,
    lookFor: verdictLookForHints(tone, args.sourceQuality),
    sourceQuality: args.sourceQuality,
    generatedBy: "note",
  };
}

export function buildReviewCoachingSystemPrompt(): string {
  return [
    "Human graph-review coach. Output JSON only.",
    '{"focus":"≤20 words, idea-specific hook","look_for":["≤10 words","optional second"]}',
    "No invented facts. focus = what to double-check for THIS claim. look_for = max 2 source checks.",
  ].join(" ");
}

export function buildReviewCoachingUserPrompt(args: {
  ideaText: string;
  validationStatus: string | null;
  validationNote: string | null;
  sourceTitle: string | null;
  sourceExcerpt: string;
  sourceQuality: GraphReviewCoachingSourceQuality;
}): string {
  const status = normalizeValidationStatus(args.validationStatus) ?? "unchecked";
  const idea =
    args.ideaText.trim().length > 400
      ? `${args.ideaText.trim().slice(0, 397)}…`
      : args.ideaText.trim();
  const excerpt = args.sourceExcerpt.trim().slice(0, SOURCE_EXCERPT_CHARS);
  return [
    `IDEA: ${idea}`,
    `AI_VERDICT: ${status}`,
    args.validationNote?.trim() ? `AI_NOTE: ${args.validationNote.trim().slice(0, 240)}` : null,
    args.sourceTitle ? `SOURCE: ${args.sourceTitle}` : null,
    `SOURCE_QUALITY: ${args.sourceQuality}`,
    excerpt ? `EXCERPT: ${excerpt}` : "EXCERPT: (none)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseGraphReviewCoachingResponse(
  raw: string,
  sourceQuality: GraphReviewCoachingSourceQuality,
): GraphReviewCoaching | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      obj = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const focus =
    typeof rec.focus === "string"
      ? rec.focus.trim()
      : typeof rec.summary === "string"
        ? rec.summary.trim()
        : "";
  if (!focus) return null;

  const lookRaw = rec.look_for ?? rec.source_checks;
  const lookFor = Array.isArray(lookRaw)
    ? lookRaw
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, MAX_LOOK_FOR)
    : [];

  return {
    focus: focus.length > MAX_FOCUS_CHARS ? `${focus.slice(0, MAX_FOCUS_CHARS - 1)}…` : focus,
    lookFor,
    sourceQuality,
    generatedBy: "llm",
  };
}

export function fallbackGraphReviewCoaching(args: {
  validationStatus: string | null;
  validationNote: string | null;
  sourceQuality: GraphReviewCoachingSourceQuality;
  hasSourceLink: boolean;
}): GraphReviewCoaching {
  const fromNote = coachingFromAiValidationNote({
    validationStatus: args.validationStatus,
    validationNote: args.validationNote,
    sourceQuality: args.sourceQuality,
  });
  if (fromNote) return { ...fromNote, generatedBy: "fallback" };

  const guidance = graphReviewGuidance(args.validationStatus, args.validationNote);
  const verdict = guidance.verdictTone;
  return {
    focus: guidance.detail.length > MAX_FOCUS_CHARS
      ? `${guidance.detail.slice(0, MAX_FOCUS_CHARS - 1)}…`
      : guidance.detail,
    lookFor: verdictLookForHints(verdict, args.sourceQuality),
    sourceQuality: args.sourceQuality,
    generatedBy: "fallback",
  };
}

export function inferSourceQualityForCoaching(args: {
  hasSourceLink: boolean;
  resolvedQuality?: GraphReviewCoachingSourceQuality;
}): GraphReviewCoachingSourceQuality {
  return args.resolvedQuality ?? (args.hasSourceLink ? "preview" : "missing");
}
