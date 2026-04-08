import type { JudgeRubric, StructuredCheck } from "./success-criteria.js";

/**
 * One atomic expectation (for traces, reports, or normalised criteria).
 * Config YAML may use the flatter `SuccessCriteria` shape instead.
 */
export type Assertion =
  | UrlAssertion
  | DomAssertion
  | TextPresentAssertion
  | TextAbsentAssertion
  | StructuredAssertion
  | JudgeAssertion;

export interface UrlAssertion {
  kind: "url";
  patterns: string[];
}

export interface DomAssertion {
  kind: "dom";
  selectors: string[];
}

export interface TextPresentAssertion {
  kind: "text_present";
  substrings: string[];
}

export interface TextAbsentAssertion {
  kind: "text_absent";
  substrings: string[];
}

export interface StructuredAssertion {
  kind: "structured";
  check: StructuredCheck;
}

export interface JudgeAssertion {
  kind: "judge";
  rubric: JudgeRubric;
}
