/**
 * Redact and classify review notes before telemetry persistence (Phase 6).
 */
import { HUMAN_REVIEW_NOTE_PREFIX } from "$lib/connect/validation-status";

export type NoteTheme =
  | "paraphrase_ok"
  | "missing_qualification"
  | "wrong_source"
  | "duplicate"
  | "ontology_mismatch"
  | "other";

const THEME_PATTERNS: { theme: NoteTheme; pattern: RegExp }[] = [
  { theme: "paraphrase_ok", pattern: /\b(paraphrase|faithful|same meaning|accurate)\b/i },
  { theme: "missing_qualification", pattern: /\b(qualif|hedge|nuance|overstate|missing context)\b/i },
  { theme: "wrong_source", pattern: /\b(wrong source|not in (the )?text|hallucin|invented)\b/i },
  { theme: "duplicate", pattern: /\b(duplicate|repeat|redundant|near.?dup)\b/i },
  { theme: "ontology_mismatch", pattern: /\b(type|ontology|pattern|relation).*(wrong|mismatch|invalid)\b/i },
];

export function stripHumanReviewPrefix(note: string | null | undefined): string {
  const trimmed = note?.trim() ?? "";
  if (trimmed.startsWith(HUMAN_REVIEW_NOTE_PREFIX)) {
    const rest = trimmed.slice(HUMAN_REVIEW_NOTE_PREFIX.length).trim();
    const dash = rest.indexOf("—");
    if (dash >= 0) return rest.slice(dash + 1).trim();
    return rest;
  }
  return trimmed;
}

export function redactReviewNote(note: string | null | undefined, maxLen = 500): string | null {
  let text = stripHumanReviewPrefix(note);
  if (!text) return null;
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  text = text.replace(/https?:\/\/\S+/gi, "[url]");
  text = text.replace(/"[^"]{80,}"/g, "[redacted quote]");
  text = text.replace(/'[^']{80,}'/g, "[redacted quote]");
  if (text.length > maxLen) text = `${text.slice(0, maxLen - 3)}...`;
  return text;
}

export function classifyNoteTheme(note: string | null | undefined): NoteTheme {
  const text = note?.trim() ?? "";
  if (!text) return "other";
  for (const { theme, pattern } of THEME_PATTERNS) {
    if (pattern.test(text)) return theme;
  }
  return "other";
}

export type VerdictDelta =
  | "agree_ok"
  | "agree_weak"
  | "agree_unsupported"
  | "weak_to_ok"
  | "weak_to_weak"
  | "weak_to_unsupported"
  | "unsupported_to_ok"
  | "unsupported_to_weak"
  | "unsupported_to_unsupported"
  | "ok_to_weak"
  | "ok_to_unsupported"
  | "removed_after_weak"
  | "removed_after_unsupported"
  | "removed_after_ok"
  | "removed";

export function deriveVerdictDelta(
  aiStatus: string | null,
  humanStatus: string,
  removed = false,
): VerdictDelta {
  if (removed) {
    if (aiStatus === "weak") return "removed_after_weak";
    if (aiStatus === "unsupported") return "removed_after_unsupported";
    if (aiStatus === "ok") return "removed_after_ok";
    return "removed";
  }
  if (aiStatus === humanStatus) {
    if (humanStatus === "ok") return "agree_ok";
    if (humanStatus === "weak") return "agree_weak";
    if (humanStatus === "unsupported") return "agree_unsupported";
  }
  return `${aiStatus ?? "unknown"}_to_${humanStatus}` as VerdictDelta;
}

export function deriveActionType(
  aiStatus: string | null,
  humanStatus: string,
  removed = false,
): "confirm" | "override" | "remove" {
  if (removed) return "remove";
  if (aiStatus === humanStatus) return "confirm";
  return "override";
}
