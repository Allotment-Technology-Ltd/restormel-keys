/** Lightweight extraction + expectation (e.g. JSON path or DOM snapshot handle). */
export interface StructuredCheck {
  id?: string;
  /** Runner-defined path or selector language; keep opaque at contract level. */
  path: string;
  expect?: unknown;
}

/** Keys-backed rubric / judge step; no prompts or secrets inline. */
export interface JudgeRubric {
  id: string;
  /** Logical model ref (Keys slot), e.g. same convention as EnvironmentProfile.keys */
  modelRef?: string;
  /** Short label for reports; full prompts live outside the contract. */
  summary?: string;
  /**
   * Optional CSS selector; judge sees innerText of first match only (smaller, less PII than full body).
   * When omitted, runner prefers `main` then falls back to `body` with a strict character cap.
   */
  contextSelector?: string;
}

/**
 * Success criteria as loaded from repo config (MVP shapes).
 * See `successCriteriaToAssertions` to normalise to `Assertion[]`.
 */
export interface SuccessCriteria {
  /**
   * At least two alternative criteria bundles; the goal passes if **any** branch passes.
   * When set, no other keys may appear at this level (use nested objects inside each branch).
   */
  anyOf?: SuccessCriteria[];
  urlMatches?: string | string[];
  domSignals?: string[];
  textPresent?: string[];
  textAbsent?: string[];
  structuredChecks?: StructuredCheck[];
  judgeRubric?: JudgeRubric;
}
