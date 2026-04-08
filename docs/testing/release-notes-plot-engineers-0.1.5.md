# Restormel Testing **v0.1.5** — notes for Plotbudget engineers

**Audience:** Teams on **`@restormel/testing-*` `^0.1.3`** or **`^0.1.4`** who want the latest contract (business acceptance, optional built-in AC browser agent, agent missions, reporting, CLI + Keys env parity).  
**Canonical spec:** [config-reference-mvp.md](config-reference-mvp.md) · **Install patterns:** [oss-consumption.md](oss-consumption.md)

**Why 0.1.5:** Tag **`testing-v0.1.4`** shipped most packages at **0.1.4** on npm but **`@restormel/testing-cli`** and **`@restormel/testing-keys-adapter`** were still at **0.1.3** in the tagged tree. **v0.1.5** republishes the **full** line at one version — use **`^0.1.5`** (or **`^0.1.4`** only if you accept mixed CLI/adapter vs peers; not recommended).

---

## 1. What to change in your repo

| Action | Detail |
|--------|--------|
| **Bump devDependencies** | Prefer one line: **`pnpm add -D @restormel/testing-bundle@^0.1.5`** (or bump **`@restormel/testing-cli`** and any direct **`@restormel/testing-*`** peers to **`^0.1.5`**). |
| **Playwright** | Unchanged: still install browsers for the adaptor (e.g. **`pnpm exec playwright install chromium`**) per [oss-consumption.md](oss-consumption.md). |
| **GitHub Action** | If you pin **`@restormel/testing-github-action`**, use **`^0.1.5`**. |
| **Lockfile** | Run install and commit **`pnpm-lock.yaml`** (or npm/yarn equivalent). |

---

## 2. New capabilities (since **v0.1.3**)

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

### CLI + Keys adapter (**0.1.4+** in repo; **0.1.5** on npm)

- **`RESTORMEL_KEYS_BASE`** for resolve URL when **`RESTORMEL_KEYS_API_BASE_URL`** is unset.
- Bearer precedence for resolve: optional **`RESTORMEL_KEYS_API_TOKEN_ENV`**, then **`RESTORMEL_KEYS_API_TOKEN`**, **`RESTORMEL_GATEWAY_KEY`**, **`RESTORMEL_SERVER_TOKEN`**.
- **`testing doctor`** aligned with the adapter.

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

Live dashboard guides: **[https://restormel.dev/testing/docs/](https://restormel.dev/testing/docs/)**.

---

## 5. Publish status

**npm:** maintainers push tag **`testing-v0.1.5`** (or **`workflow_dispatch`** on [**Publish Testing packages**](https://github.com/Allotment-Technology-Ltd/restormel-keys/actions)). Confirm with **`npm view @restormel/testing-cli version`** and **`npm view @restormel/testing-bundle version`** (expect **`0.1.5`**).
