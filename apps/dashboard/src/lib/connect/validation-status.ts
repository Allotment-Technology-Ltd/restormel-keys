/** Shared validation_status semantics (client + server) for graph explorer and re-validation. */

import type { ConnectGraphRevalidateScope } from "@restormel/contracts/connect";

export type KnownValidationStatus = "ok" | "weak" | "unsupported";

export function normalizeValidationStatus(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "unvalidated" || s.toLowerCase() === "none") return null;
  return s;
}

/** Matches graph explorer "Unchecked" counts and filters. */
export function isUncheckedValidationStatus(raw: string | null | undefined): boolean {
  const s = normalizeValidationStatus(raw);
  return s !== "ok" && s !== "weak" && s !== "unsupported";
}

export function isKnownValidationStatus(s: string | null): s is KnownValidationStatus {
  return s === "ok" || s === "weak" || s === "unsupported";
}

/** Prefix written when an operator saves a verdict on the graph review screen. */
export const HUMAN_REVIEW_NOTE_PREFIX = "Human review:";

export function formatHumanReviewNote(
  status: KnownValidationStatus,
  operatorNote?: string | null,
): string {
  const trimmed = operatorNote?.trim();
  if (trimmed) {
    return `${HUMAN_REVIEW_NOTE_PREFIX} ${status} — ${trimmed}`;
  }
  return status === "ok"
    ? `${HUMAN_REVIEW_NOTE_PREFIX} supported`
    : `${HUMAN_REVIEW_NOTE_PREFIX} ${status}`;
}

export function hasHumanReviewNote(validationNote: string | null | undefined): boolean {
  const note = validationNote?.trim() ?? "";
  return note.startsWith(HUMAN_REVIEW_NOTE_PREFIX);
}

/** Weak/unsupported ideas the AI flagged that have not been triaged by a human yet. */
export function isAwaitingHumanTriage(
  validationStatus: string | null | undefined,
  validationNote: string | null | undefined,
): boolean {
  const s = normalizeValidationStatus(validationStatus);
  if (s !== "weak" && s !== "unsupported") return false;
  return !hasHumanReviewNote(validationNote);
}

/** Server-side scope filter for graph re-validation jobs (mirrors ConnectGraphRevalidateScope). */
export function matchesGraphRevalidateScope(
  validationStatus: string | null | undefined,
  validationNote: string | null | undefined,
  scope: ConnectGraphRevalidateScope,
): boolean {
  const status = normalizeValidationStatus(validationStatus);
  if (scope === "all") return true;
  if (scope === "unchecked") return isUncheckedValidationStatus(validationStatus);
  if (scope === "flagged") return status === "weak" || status === "unsupported";
  if (scope === "quarantine") return isAwaitingHumanTriage(validationStatus, validationNote);
  if (scope === "unsupported") {
    return status === "unsupported" && !hasHumanReviewNote(validationNote);
  }
  return false;
}
