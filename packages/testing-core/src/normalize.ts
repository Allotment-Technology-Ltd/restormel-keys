import type { Assertion } from "./assertion.js";
import type { SuccessCriteria } from "./success-criteria.js";

/** Flattens repo-config `SuccessCriteria` into discrete assertions for runners or traces. */
export function successCriteriaToAssertions(criteria: SuccessCriteria): Assertion[] {
  const out: Assertion[] = [];
  if (criteria.urlMatches != null) {
    const patterns = Array.isArray(criteria.urlMatches)
      ? criteria.urlMatches
      : [criteria.urlMatches];
    if (patterns.length > 0) {
      out.push({ kind: "url", patterns: [...patterns] });
    }
  }
  if (criteria.domSignals != null && criteria.domSignals.length > 0) {
    out.push({ kind: "dom", selectors: [...criteria.domSignals] });
  }
  if (criteria.textPresent != null && criteria.textPresent.length > 0) {
    out.push({ kind: "text_present", substrings: [...criteria.textPresent] });
  }
  if (criteria.textAbsent != null && criteria.textAbsent.length > 0) {
    out.push({ kind: "text_absent", substrings: [...criteria.textAbsent] });
  }
  for (const check of criteria.structuredChecks ?? []) {
    out.push({ kind: "structured", check });
  }
  if (criteria.judgeRubric != null) {
    out.push({ kind: "judge", rubric: criteria.judgeRubric });
  }
  return out;
}
