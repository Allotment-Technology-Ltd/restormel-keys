/** Retries and backoff are interpreted by the runner; suite may override defaults. */
export interface RetryPolicy {
  maxRetries: number;
  /** Delay between attempts (ms); omit for runner default. */
  backoffMs?: number;
}

/** What to capture to disk or CI artefacts (no remote retention implied). */
export interface ArtifactPolicy {
  screenshots: "never" | "on_failure" | "always";
  browserTrace: "never" | "on_failure" | "always";
  console: boolean;
}
