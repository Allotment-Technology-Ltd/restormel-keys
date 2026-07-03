/** Stable artefact basenames under each run directory (early-adopter contract). */
export const RUN_JSON = "run.json" as const;
export const TRACES_JSON = "traces.json" as const;
export const WARNINGS_TXT = "warnings.txt" as const;
export const REPORT_JSON = "report.json" as const;
export const SUMMARY_MD = "summary.md" as const;
export const GITHUB_SUMMARY_MD = "github-summary.md" as const;
export const JUNIT_XML = "junit.xml" as const;
/** Written when `run` exits before a {@link RunRecord} exists (config / suite resolution errors). */
export const PRE_RUN_FAILURE_JSON = "pre-run-failure.json" as const;
/** Governance export: route/policy versions + Testing summary (see `release-pack.ts`). */
export const RELEASE_PACK_JSON = "release-pack.json" as const;
