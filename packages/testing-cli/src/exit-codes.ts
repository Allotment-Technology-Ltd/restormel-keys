/** Normal success. */
export const EXIT_OK = 0;

/**
 * Run finished but suite did not pass (failed / indeterminate), or unexpected runtime failure.
 * Use in CI to fail the job when tests fail.
 */
export const EXIT_FAILED = 1;

/** Invalid usage, missing arguments, missing files, or invalid config (validate / init guardrails). */
export const EXIT_USAGE = 2;
