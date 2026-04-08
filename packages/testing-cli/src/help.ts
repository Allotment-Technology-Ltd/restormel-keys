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
  ${program} run --suite web-critical --goal smoke,login --config restormel-testing.yaml
  ${program} report .restormel-testing/runs/run-2026-04-07
  ${program} doctor --config restormel-testing.yaml

Environment (Keys / judges — values never printed):
  RESTORMEL_KEYS_API_BASE_URL     Keys HTTP API origin (optional)
  RESTORMEL_KEYS_API_TOKEN_ENV    Name of env var with Keys API bearer (default RESTORMEL_KEYS_API_TOKEN)
  RESTORMEL_TESTING_OPENAI_FALLBACK   Set to 1 for documented OPENAI_API_KEY fallback when Keys unset

See docs/config-reference-mvp.md for supported YAML, CLI --json behaviour, and judge_rubric notes.
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
    console.log(`${program} run --suite <name> [options]

Run a suite. Writes JSON artefacts under --artifact-dir (default: timestamped dir under .restormel-testing/runs/).

Exit codes: 0 passed, 1 suite failed or indeterminate, 2 config or usage error.

Options:
      --suite <name>        Suite id from the config (required)
      --goal <ids>          Comma-separated goal ids (subset of suite; repeatable)
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

Check Node 20+, optional config readability, Playwright Chromium install, and whether Keys-related env vars are set (names only).

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
