# Restormel Testing **v0.1.4** — notes for Plotbudget engineers

**Audience:** Teams already on **`@restormel/testing-*` `^0.1.3`** who want the latest contract (business acceptance, optional built-in AC browser agent, agent missions, reporting).  
**Canonical spec:** [config-reference-mvp.md](config-reference-mvp.md) · **Install patterns:** [oss-consumption.md](oss-consumption.md)

---

## 1. What to change in your repo

| Action | Detail |
|--------|--------|
| **Bump devDependencies** | Prefer one line: **`pnpm add -D @restormel/testing-bundle@^0.1.4`** (or bump **`@restormel/testing-cli`** and any direct **`@restormel/testing-*`** peers to **`^0.1.4`** so the whole line resolves together). |
| **Playwright** | Unchanged: still install browsers for the adaptor (e.g. **`pnpm exec playwright install chromium`**) per [oss-consumption.md](oss-consumption.md). |
| **GitHub Action** | If you pin **`@restormel/testing-github-action`** by version in **`package.json`**, bump to **`^0.1.4`** or reinstall so `node_modules` matches the published action package. |
| **Lockfile** | Run install and commit **`pnpm-lock.yaml`** (or npm/yarn equivalent). |

No change is *required* if you only use **`observe`** goals and do not need acceptance-criteria reporting — but you should still align versions to avoid mixed **`0.1.3` / `0.1.4`** trees.

---

## 2. New capabilities (v0.1.4 vs v0.1.3)

### Suite-level business acceptance (BA)

- **`user_story` / `userStory`** and **`acceptance_criteria` / `acceptanceCriteria`**: ordered **`{ id, text }[]`** on the suite.
- **Per-goal** **`acceptance_criterion_ids` / `acceptanceCriterionIds`**: links automation to those ids for roll-up and filtering.
- **CLI:** **`testing run … --ac <id>`** (repeatable) runs only goals that reference those criterion ids.
- **Run output:** **`RunRecord.acceptanceResults`** plus richer summaries in **`report.json`**, Markdown, and GitHub summary (see **`@restormel/testing-report`**).

*Example config:* [examples/testing-business-acceptance/restormel-testing.yaml](../../examples/testing-business-acceptance/restormel-testing.yaml) (in this repo).

### `execution_mode: agent` (external executor, then browser checks)

- Browser goal runs **`mission_executor`** (shell) with mission text and documented **`RESTORMEL_TESTING_*`** env (including optional **`RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON`** + **`RESTORMEL_TESTING_USER_STORY`** when the suite declares them).
- After exit **0**, the runner opens Playwright and evaluates **`success_criteria`** (or **`after_agent`** overrides).
- **Doc:** [agent-missions.md](agent-missions.md).

### `execution_mode: ac_sequence` (optional, Keys-backed LLM in-runner)

- **Suite must** declare **`acceptance_criteria`**. Goal includes **`ac_sequence`** with **`built_in_agent`** (model via **`model_ref`** or env keys such as **`llm_primary`**).
- Runner steps **each** criterion **in order** with a **built-in** multi-turn browser agent (JSON actions: navigate, role/CSS clicks, fill, wait, done / give-up; same-origin guard).
- Optional per-AC gates: **`criterion_success`** (deterministic + judge), **`criterion_rubrics`** (LLM judge JSON must echo **`ac_id`**), **`post_checks`** (HTTP, DOM **`dom_role_name`**, **`db_shell`**), and **`criterion_executor`** shell before each AC.
- **Goal run** includes **`acSequenceSteps`** for debugging and reports; **acceptance roll-up** uses step-level verdicts when present.
- Top-level **`success_criteria`** may be **omitted or empty** for this mode. If **`acceptance_criterion_ids`** is omitted on the goal, it defaults to **all** suite criterion ids in order.

Use this when you want **Restormel to own** the browser stepping for each AC. Use **`agent`** mode when **your** CLI/script owns the mission and the runner only **observes** afterward.

---

## 3. Environment variables (quick reference)

| Variable | When |
|----------|------|
| **`RESTORMEL_TESTING_USER_STORY`**, **`RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON`** | Set for **`mission_executor`** when the suite has a user story / acceptance criteria (JSON shape: `{ userStory, acceptanceCriteria }`). |
| **`RESTORMEL_TESTING_MISSION`**, **`RESTORMEL_TESTING_BASE_URL`**, **`RESTORMEL_TESTING_GOAL_ID`**, **`RESTORMEL_TESTING_RUN_ID`** | Agent mission phase (see [agent-missions.md](agent-missions.md)). |
| **`RESTORMEL_TESTING_AC_ID`**, **`RESTORMEL_TESTING_AC_TEXT`**, **`RESTORMEL_TESTING_AC_INDEX`** | **`ac_sequence`** per-criterion hooks: **`criterion_executor`**, **`post_checks.db_shell`**. |

Shell hook skip/timeout unchanged: **`RESTORMEL_TESTING_SKIP_SHELL_HOOKS`**, **`RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS`**.

---

## 4. Documentation map

| Topic | Where |
|--------|--------|
| Full YAML + validation rules | [config-reference-mvp.md](config-reference-mvp.md) |
| Agent missions (external executor) | [agent-missions.md](agent-missions.md) |
| npm / CI install | [oss-consumption.md](oss-consumption.md) |
| Earlier Plot-focused delta (0.1.x line context) | [release-notes-plot-engineers-2026-04.md](release-notes-plot-engineers-2026-04.md) |
| Publish / tag process (maintainers) | [npm-publish-checklist.md](npm-publish-checklist.md) |

Live dashboard guides (same topics, product copy): **[https://restormel.dev/testing/docs/](https://restormel.dev/testing/docs/)** — configuration, test definition, CI, Keys checklist.

---

## 5. Publish status

**npm:** packages publish when maintainers push git tag **`testing-v0.1.4`** or run [**Publish Testing packages**](https://github.com/Allotment-Technology-Ltd/restormel-keys/actions) (`workflow_dispatch`) with **`NPM_TOKEN`** set. After publish, confirm versions with **`npm view @restormel/testing-cli version`**.

If **`0.1.4` is not on npm yet**, stay on **`^0.1.3`** until the tag lands, then bump per section 1.
