# @restormel/keys-cli

CLI for Restormel Keys: reduce setup friction for Next.js, React, SvelteKit, and Astro.

## Install

Use current npm release (**≥0.1.4** for `keys patch` + `@restormel/keys@0.2.7` train; latest trains with core/doctor/validate). **v0.1.0** had broken deps.

```bash
pnpm add -D @restormel/keys-cli
```

If you only need checks (no Keys scaffolding), use the standalone wedge CLIs:

```bash
npx @restormel/doctor
npx @restormel/validate
```

## Commands

| Command | Description |
|--------|-------------|
| `keys init` | Detect framework, generate config, suggest packages |
| `keys add <provider>` | Prompt for API key, validate, store (openai \| anthropic \| google) |
| `keys list` | Show stored keys (masked) |
| `keys validate` | Wrapper for `restormel-validate` (exit 1 if invalid — CI-friendly) |
| `keys doctor [--report]` | Wrapper for `restormel-doctor` (setup/health checks); `--report` prints a pre-filled GitHub issue URL when checks fail |
| `keys estimate <model> --input <n> --output <n>` | Cost estimate for a model |
| `keys login` | Device login: browser-approved Gateway key in the terminal (OAuth-style device flow) |
| `keys patch` | One-command patch upgrade for installed Restormel packages + optional catalog verification |
| `keys catalog fetch` | Fetch public `GET /keys/dashboard/api/catalog` (summary or `--json`; optional `--base-url`, paging, `--include-unhealthy`, `--skip-allowlist`) |
| `keys replay <traceId\|traceFile>` | Replay a past Connect retrieval against the current graph and diff the results (`--diff`, `--compare`, `--output json\|pretty\|markdown`) |
| `keys rules show` / `keys rules list` | Inspect the verification rule set (six-dimension weights + strict/balanced/lenient policies) active for your workspace |
| `keys connect eval` | Headless G2 quality verdict for Connect ingest (`--job`, `--counts`, `--stdin`, `--output json\|pretty`) with stable exit codes — CI-friendly |

### Replay a retrieval (provenance traces)

Every Connect `POST /connect/v1/retrieve` and `/connect/v1/graph` query returns a `trace_id`.
`keys replay` re-runs that exact query — same verification policy, depth, and token budget — against
the current graph and reports which claims are **stable**, **changed/removed**, or **new**. This
deterministically reproduces an agent's retrieval and surfaces graph drift.

```bash
# By trace id (needs RESTORMEL_GATEWAY_KEY + RESTORMEL_WORKSPACE_ID, or run `keys login`)
keys replay 7b9f… --diff

# From a saved trace file, as JSON or markdown
keys replay ./trace.json --output json
keys replay ./trace.json --compare --output markdown
```

Traces are retained for 90 days; for older queries, replay a locally saved trace file. A drift
warning is emitted when more than half the original claims changed since the trace was recorded.

### Headless quality eval (Connect)

`keys connect eval` judges a Connect graph's ingest quality against the published G2 bar
(**≥ 90% supported, ≤ 2% unsupported** — the same `computeG2Metrics`/`assertG2Targets` math the
pipeline itself uses) and emits a versioned JSON verdict (`@restormel/contracts/connect-eval`)
plus a human-readable summary. Built for CI: the exit code is the contract.

| Exit code | Meaning |
|-----------|---------|
| `0` | Pass — quality bar met |
| `1` | Quality fail — `reasons` lists each breached bar |
| `2` | Config/usage error (bad flags, missing key/workspace, unreadable input, API error) |

**Remote mode** (default) reads the latest ingest run's public quality report from the
gateway-key-authed `GET /connect/v1/ingest/jobs` API — no dashboard session needed:

```bash
# Latest assessed run in the workspace (needs RESTORMEL_GATEWAY_KEY + RESTORMEL_WORKSPACE_ID, or `keys login`)
keys connect eval --workspace <workspace-id>

# A specific ingest job, as JSON for CI logs
keys connect eval --job <job-id> --output json
```

**Local mode** evaluates a counts document produced by a run's quality report or any pipeline —
no network, fully deterministic:

```bash
# {ok,weak,unsupported} counts (optional: trust_score, coverage_gaps, fingerprint)
keys connect eval --counts ./counts.json

# Or pipe a saved quality report (the GET /connect/v1/ingest/jobs job.quality_report object)
cat quality-report.json | keys connect eval --stdin --output json
```

Verdict shape (schema version `1.0`):

```json
{
  "schema_version": "1.0",
  "evaluated_at": "2026-06-09T12:00:00.000Z",
  "source": { "kind": "ingest_job", "workspace_id": "…", "job_id": "…", "assessed_at": "…" },
  "g2": { "ok": 95, "weak": 3, "unsupported": 1, "ok_pct": 96, "unsupported_pct": 1 },
  "targets": { "ok_pct_min": 90, "unsupported_pct_max": 2 },
  "trust_score": 88,
  "pass": true,
  "reasons": []
}
```

`coverage_gaps` and `fingerprint` are carried through when the producing pipeline supplies them.
**Stage 2.2 adds `--baseline <file|ref>` diffing** (regression detection against a saved verdict,
keyed by source-set fingerprint) on top of this verdict contract.

### Canonical catalog (public feed)

Verify connectivity and inspect contract version (uses `RESTORMEL_KEYS_BASE` or `https://restormel.dev`):

```bash
npx @restormel/keys-cli catalog fetch
npx @restormel/keys-cli catalog fetch --json | jq .contractVersion
```

### One-command patch upgrades

```bash
npx @restormel/keys-cli patch
```

This command detects your package manager, updates installed `@restormel/*` packages to latest patch-compatible versions, and verifies the canonical provider/model catalog endpoint (`/keys/dashboard/api/catalog`) when possible.

- In **pnpm workspaces**, running from the workspace root uses a recursive upgrade (`pnpm up -r`) so you do not hit root add checks.
- If you prefer a preview first, use `npx @restormel/keys-cli patch --dry-run`.

## Config and storage

- **Config** (`restormel.config.json`): framework and provider list only — **no secrets**.
- **Key store** (`.restormel/key-store.json`): holds API keys for local use. Add `.restormel/` to `.gitignore`; never commit.

## Gate

In a fresh Next.js (App Router) project, `npx @restormel/doctor` should run and report framework and package status. Run `keys init` first to create config; then `restormel-doctor` exits 0 when setup is OK.
