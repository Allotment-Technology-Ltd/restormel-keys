import type { Verdict } from "@restormel/testing-core";

/**
 * Coarse triage category derived from `reasonCode` (stable for dashboards).
 */
export type FailureBucket =
  | "none"
  | "assertion"
  | "timeout"
  | "adapter"
  | "browser"
  | "judge"
  | "keys_config"
  | "unsupported"
  | "config"
  | "unknown";

/**
 * Map runner reason codes to a failure bucket for triage (no model internals).
 */
export function inferFailureBucket(reasonCode: string, verdict: Verdict): FailureBucket {
  if (verdict === "passed") {
    return "none";
  }

  const c = reasonCode.toUpperCase();

  if (c.startsWith("URL_") || c.startsWith("TEXT_") || c.startsWith("DOM_") || c === "STRUCTURED_MISMATCH") {
    return "assertion";
  }
  if (c === "TIMEOUT") {
    return "timeout";
  }
  if (c === "ADAPTER_ERROR") {
    return "adapter";
  }
  if (c === "BROWSER_ERROR") {
    return "browser";
  }
  if (c.startsWith("JUDGE_")) {
    if (c === "JUDGE_NO_MODEL") {
      return "keys_config";
    }
    return "judge";
  }
  if (c === "GOAL_TYPE_UNSUPPORTED" || c === "STRUCTURED_PATH_UNKNOWN" || c === "NO_CRITERIA") {
    return "unsupported";
  }
  if (c.includes("CONFIG") || c === "INVALID") {
    return "config";
  }

  return "unknown";
}
