const KNOWN_TOPICS = new Set(["init", "validate", "run", "report", "doctor"]);

export function printGlobalHelp(program: string): void {
  console.log(`${program} — Restormel / Testing CLI

Usage:
  ${program} <command> [options]

Commands:
  init       Write a starter config file (or print it with --print)
  validate   Check that a config file parses and satisfies the schema
  run        Execute a browser suite locally and write report artefacts
  report     Print a human summary from a previous run directory
  doctor     Check Node, optional config file, Playwright Chromium, Keys env hints

Global options:
  -h, --help       Show help (optionally: ${program} help <command>)
  -v, --version    Print CLI version

Examples:
  ${program} init
  ${program} validate --config restormel-testing.yaml
  ${program} validate --config restormel-testing.yaml --json
  ${program} run --suite web-critical --config restormel-testing.yaml
  ${program} run --suites ci-smoke,web-critical --config restormel-testing.yaml
  ${program} run --suite web-critical --goal smoke,login --config restormel-testing.yaml
  ${program} report .restormel-testing/runs/run-2026-04-07
  ${program} doctor --config restormel-testing.yaml

Environment (Keys / judges — values never printed):
  RESTORMEL_KEYS_BASE             Canonical site origin for Keys HTTP resolve (optional; alias: RESTORMEL_KEYS_API_BASE_URL)
  RESTORMEL_GATEWAY_KEY           Canonical bearer for resolve (optional; alias: RESTORMEL_KEYS_API_TOKEN)
  RESTORMEL_KEYS_API_TOKEN_ENV    Name of env var with Keys HTTP bearer (default RESTORMEL_KEYS_API_TOKEN)
  RESTORMEL_TESTING_OPENAI_FALLBACK   Set to 1 for documented OPENAI_API_KEY fallback when Keys unset

Shell hooks (adapter_hooks, preconditions, cleanup):
  RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1   Skip all shell hooks
  RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS   Per-hook timeout ms (default 120000)

Lighthouse structured_checks (see docs):
  RESTORMEL_TESTING_SKIP_LIGHTHOUSE=1   Skip Lighthouse checks (indeterminate)
  RESTORMEL_TESTING_LIGHTHOUSE_TIMEOUT_MS   One run timeout ms (default 180000)

See docs/testing/config-reference-mvp.md for supported YAML, CLI --json behaviour, vitals, Lighthouse paths, and judge_rubric notes.
`);
}

/** @returns false if topic is unknown */
export function printCommandHelp(program: string, topic: string): boolean {
  const t = topic.toLowerCase();
  if (!KNOWN_TOPICS.has(t)) {
    console.error(`Unknown help topic: ${topic}`);
    console.error(`Try: ${program} help init | validate | run | report | doctor`);
    return false;
  }

  if (t === "init") {
    console.log(`${program} init [options]

Write 'restormel-testing.yaml' (or another path via --config) with a minimal valid example.

Options:
  -c, --config <path>   Output file (default: restormel-testing.yaml)
      --print           Print to stdout instead of writing a file
      --force           Overwrite an existing file
`);
    return true;
  }

  if (t === "validate") {
    console.log(`${program} validate [options]

Validate configuration. Exits 0 if valid, non-zero if not.

Options:
  -c, --config <path>   Config file (default: restormel-testing.yaml)
      --json              Print { ok, schema_version } or { ok: false, errors } to stdout
`);
    return true;
  }

  if (t === "run") {
    console.log(`${program} run --suite <name> … [options]

Run one or more suites. Use --suite repeatedly or --suites a,b,c. Writes JSON artefacts under --artifact-dir (default: timestamped dir under .restormel-testing/runs/); multiple suites use one base dir and per-suite subfolders.

Exit codes: 0 passed, 1 suite failed or indeterminate, 2 config or usage error.

Options:
      --suite <name>        Suite id (repeatable for multiple suites)
      --suites <a,b,c>      Comma-separated suite ids (alternative to multiple --suite)
      --goal <ids>          Comma-separated goal ids (subset of suite; repeatable)
      --ac <ids>            Comma-separated acceptance_criteria ids (goals must list them in acceptance_criterion_ids)
  -c, --config <path>       Config file (default: restormel-testing.yaml)
      --environment, --env <id>  Environment id (default: suite's environment)
      --target-url <url>    Override base URL (e.g. preview deploy; no credentials in URL)
      --commit-sha <sha>    Record in run metadata
      --repository <slug> Record in run metadata (e.g. org/name)
      --artifact-dir <dir>  Directory for screenshots + run.json + traces.json
      --headed              Run browser non-headless (local debugging)
      --ci                  Mark trigger as 'ci' in the run record
      --json                Print JSON to stdout. On success: verdict, run_id, artifact_dir. On pre-run failure (before RunRecord): ok false, errors, artifact_dir, partial_artifacts (includes pre-run-failure.json in the run directory)
`);
    return true;
  }

  if (t === "doctor") {
    console.log(`${program} doctor [options]

Check Node 20+, optional config readability, Playwright Chromium install, Keys-related env hints (including whether RESTORMEL_PROJECT_ID is set when RESTORMEL_KEYS_BASE or RESTORMEL_KEYS_API_BASE_URL is set), and (when Keys URL + token are set) a single POST to the resolve endpoint using bootstrap ref ref:restormel-keys:llm/primary (HTTP status only; body not printed).

Options:
  -c, --config <path>   If set, file must exist and be readable

Exit: 0 OK, 2 prerequisite failure
`);
    return true;
  }

  console.log(`${program} report <path>

Print a summary from a run artefact directory (containing run.json) or a direct path to run.json.
`);
  return true;
}
