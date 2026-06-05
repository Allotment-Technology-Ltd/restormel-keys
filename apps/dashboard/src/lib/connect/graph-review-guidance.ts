/**
 * Human review guidance for Connect graph explorer — uses ingest/re-validation
 * validation_status + validation_note (already produced by the validation LLM stage).
 */

import {
  isKnownValidationStatus,
  normalizeValidationStatus,
  type KnownValidationStatus,
} from "$lib/connect/validation-status";

export type ReviewVerdictAction = KnownValidationStatus;

export type GraphReviewGuidance = {
  verdictLabel: string;
  verdictTone: KnownValidationStatus | "unchecked";
  /** Which review button to emphasize (matches AI verdict). */
  suggestedAction: ReviewVerdictAction | null;
  headline: string;
  detail: string;
  actionHint: string;
};

const FALLBACK_DETAIL: Record<ReviewVerdictAction, string> = {
  weak: "The claim may overstate the source, miss qualification, or be only loosely grounded.",
  unsupported: "The claim contradicts the source or adds facts with no clear basis in the text.",
  ok: "The claim appears faithful to the source as a paraphrase or grounded inference.",
};

const ACTION_HINT: Record<ReviewVerdictAction, string> = {
  weak:
    "The highlighted action matches the AI verdict. Confirm weak if you agree, approve only if the source fully supports the wording, or mark unsupported if the claim is wrong.",
  unsupported:
    "The highlighted action matches the AI verdict. Confirm unsupported if you agree, or approve if the source actually supports this claim.",
  ok:
    "The highlighted action matches the AI verdict. Approve if you agree, or override if the AI was too generous.",
};

export function graphReviewGuidance(
  validationStatus: string | null | undefined,
  validationNote: string | null | undefined,
): GraphReviewGuidance {
  const status = normalizeValidationStatus(validationStatus);
  const note = validationNote?.trim() ?? "";

  if (status === "weak") {
    return {
      verdictLabel: "Weak",
      verdictTone: "weak",
      suggestedAction: "weak",
      headline: "AI flagged this idea as weak",
      detail: note || FALLBACK_DETAIL.weak,
      actionHint: ACTION_HINT.weak,
    };
  }

  if (status === "unsupported") {
    return {
      verdictLabel: "Unsupported",
      verdictTone: "unsupported",
      suggestedAction: "unsupported",
      headline: "AI flagged this idea as unsupported",
      detail: note || FALLBACK_DETAIL.unsupported,
      actionHint: ACTION_HINT.unsupported,
    };
  }

  if (status === "ok") {
    return {
      verdictLabel: "Supported",
      verdictTone: "ok",
      suggestedAction: "ok",
      headline: "AI marked this idea as supported",
      detail: note || FALLBACK_DETAIL.ok,
      actionHint: ACTION_HINT.ok,
    };
  }

  return {
    verdictLabel: "Unchecked",
    verdictTone: "unchecked",
    suggestedAction: null,
    headline: "Not validated yet",
    detail:
      note ||
      "This idea has no AI verdict. Run re-validation from the graph page, or set a verdict yourself after checking the source.",
    actionHint:
      "Choose the verdict that fits after you read the source. None of the actions are pre-selected.",
  };
}

export function isSuggestedReviewAction(
  action: ReviewVerdictAction,
  suggested: ReviewVerdictAction | null,
): boolean {
  return suggested !== null && suggested === action;
}

/** Brutalist button class for a review action button. */
export function reviewActionFillClass(
  action: ReviewVerdictAction,
  suggested: ReviewVerdictAction | null,
): string {
  if (isSuggestedReviewAction(action, suggested)) return "brutal-btn-primary";
  return "brutal-btn-outline";
}

export function isKnownVerdictForGuidance(
  status: string | null | undefined,
): status is KnownValidationStatus {
  return isKnownValidationStatus(normalizeValidationStatus(status));
}
