/**
 * Restormel dashboard API client: typed resolve and evaluate.
 * Use from server-side only; never send Gateway Key to the browser.
 * @see docs/reference/policy-enforcement.md
 */
export type {
  ResolveOptions,
  ResolveSuccess,
  ResolveError,
  ResolveResult,
  EvaluateOptions,
  EvaluateResult,
  PolicyViolation,
  RestormelApiError,
  ResolveErrorBody,
} from "./types.js";

export type { AllowedModelsCandidate, FilterAllowedModelsOptions } from "./client.js";

export {
  resolve,
  evaluatePolicies,
  filterAllowedModels,
  isPolicyBlocked,
  isNoRoute,
  isUsageLimitReached,
  isPolicyBlockedError,
} from "./client.js";
