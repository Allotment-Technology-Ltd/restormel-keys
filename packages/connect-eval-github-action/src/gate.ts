/**
 * Pure helpers for the connect-eval CI gate: CLI argument building, exit-code → verdict
 * mapping, and warn-mode downgrade. No I/O — fully unit-testable (mirrors the
 * testing-github-action split: thin main, testable logic modules).
 *
 * Exit-code contract (packages/cli, Stage 2.1/2.2):
 *   0 pass · 1 absolute-bar fail · 2 config/usage error · 3 regression vs baseline
 */

export const EXIT_PASS = 0;
export const EXIT_QUALITY_FAIL = 1;
export const EXIT_CONFIG_ERROR = 2;
export const EXIT_REGRESSION = 3;

export type GateVerdict = "pass" | "quality_fail" | "config_error" | "regression" | "error";

export interface GateOptions {
  /** Local mode: counts JSON file (mutually exclusive with remote mode). */
  countsPath?: string;
  /** Remote mode refs (require RESTORMEL_GATEWAY_KEY in the child env). */
  workspace?: string;
  project?: string;
  jobId?: string;
  siteBase?: string;
  /** Baseline diff (exit 3 on regression). */
  baselinePath?: string;
  tolerance?: string;
}

/** `keys connect eval` argv (after the CLI entry). Markdown output is the comment body. */
export function buildEvalArgs(opts: GateOptions): string[] {
  const args = ["connect", "eval", "--output", "markdown"];
  if (opts.countsPath) args.push("--counts", opts.countsPath);
  if (opts.jobId) args.push("--job", opts.jobId);
  if (opts.workspace) args.push("--workspace", opts.workspace);
  if (opts.project) args.push("--project", opts.project);
  if (opts.siteBase) args.push("--site-base", opts.siteBase);
  if (opts.baselinePath) args.push("--baseline", opts.baselinePath);
  if (opts.tolerance !== undefined && opts.tolerance.trim() !== "") {
    args.push("--tolerance", opts.tolerance.trim());
  }
  return args;
}

/** Map the CLI exit code to a stable verdict output. Unknown codes are hard errors. */
export function verdictForExitCode(code: number | null): GateVerdict {
  if (code === EXIT_PASS) return "pass";
  if (code === EXIT_QUALITY_FAIL) return "quality_fail";
  if (code === EXIT_CONFIG_ERROR) return "config_error";
  if (code === EXIT_REGRESSION) return "regression";
  return "error";
}

/**
 * Warn-mode downgrade: quality fail (1) and regression (3) become exit 0 so the check
 * stays green while the gate is non-blocking. Config errors (2) and unknown failures are
 * NEVER downgraded — a broken gate must be loud even in warn mode.
 */
export function effectiveExitCode(cliCode: number | null, warnOnly: boolean): number {
  if (cliCode === null) return 1; // crashed/killed before a verdict — never downgraded
  if (!warnOnly) return cliCode;
  if (cliCode === EXIT_QUALITY_FAIL || cliCode === EXIT_REGRESSION) return EXIT_PASS;
  return cliCode;
}

export function parseBoolean(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
