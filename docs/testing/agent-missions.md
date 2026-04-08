# Agent missions (`execution_mode: agent`)

**Audience:** Teams that want **multi-step** or **LLM-driven** browser work **without** encoding every click in YAML, while still ending on **deterministic** Restormel Testing checks.

**Canonical behaviour:** same schema as [config-reference-mvp.md](config-reference-mvp.md); this page is the narrative for the **delegate** model.

## Model

- **`execution_mode: agent`** is only valid for **`type: browser`**.
- The runner does **not** embed an LLM browser agent. You supply:
  - **`mission`** — natural-language description (passed through env to your tool).
  - **`mission_executor`** — a **shell command** that implements the mission (e.g. your Playwright agent CLI, Cursor CLI, or internal harness). It must exit **0** before browser evaluation runs.
- After the executor succeeds, the runner opens Playwright, navigates, and evaluates **`success_criteria`** (and optional **`judge_rubric`**) like a normal **observe** goal — including **retries** on that phase only (the executor is **not** re-run on retry).

## Post-mission navigation and criteria

- By default, post-mission navigation uses the goal’s top-level **`start_path`** / **`startPath`** (same as observe mode).
- Optional **`after_agent`**:
  - **`start_path`** — if set, used **instead** of the top-level `start_path` for the **post-mission** browser open (useful when the executor leaves the app on a URL you then re-open under `base_url`).
  - **`success_criteria`** — if set, these criteria are used for the post-mission evaluation **instead of** the top-level **`success_criteria`** (you may omit top-level `success_criteria` when this block includes `success_criteria`).

## Environment variables passed to `mission_executor`

Merged onto `process.env` (existing vars preserved unless overridden):

| Variable | Meaning |
|----------|---------|
| `RESTORMEL_TESTING_MISSION` | The goal’s `mission` string |
| `RESTORMEL_TESTING_BASE_URL` | Environment `base_url` |
| `RESTORMEL_TESTING_START_URL` | Set when the goal has a top-level `start_path`: resolved `URL(start_path, base_url).href` |
| `RESTORMEL_TESTING_GOAL_ID` | Goal `id` |
| `RESTORMEL_TESTING_RUN_ID` | UUID for this suite run |
| `RESTORMEL_TESTING_ARTIFACT_DIR` | CLI/run `artifact_dir` when provided |
| `RESTORMEL_TESTING_STORAGE_STATE_PATH` | Resolved Playwright storage state path when `auth_ref` applies |
| `RESTORMEL_TESTING_MISSION_CONSTRAINTS` | JSON object when `mission_constraints` is set (`max_duration_ms`, `url_allowlist`) |
| `RESTORMEL_TESTING_USER_STORY` | Suite `user_story` when set (may be empty string if only criteria exist) |
| `RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON` | JSON `{"userStory"?: string, "acceptanceCriteria": { id, text }[]}` when the suite defines a story and/or acceptance criteria |

## Timeouts and skip flags

| Variable | Role |
|----------|------|
| `RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS` | Default ceiling for hook and mission commands (default **120000** ms) |
| *(from YAML)* `mission_constraints.max_duration_ms` | Runner uses **max**(shell-hook timeout, this value) for the mission command |
| `RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1` | Skip **`mission_executor`** only (post-mission browser still runs — use for CI without an agent binary) |
| `RESTORMEL_TESTING_SKIP_SHELL_HOOKS=1` | Unchanged: skips **`adapter_hooks`**, **`preconditions`**, **`cleanup`** only |

## Failure codes

- Executor non-zero or timeout → goal **`MISSION_EXECUTOR_FAILED`** (browser phase not started).

## Further reading

- [Writing good goals](writing-good-goals.md) — when **`judge_rubric`** runs relative to navigation and agent missions.
- [config-reference-mvp.md](config-reference-mvp.md) — executed vs rejected fields.
