# Restormel Testing **v0.1.5** — notes for Plotbudget engineers

**Audience:** Teams on any `**@restormel/testing-*`** line from `**0.1.1`** through `**0.1.4**` who want a single upgrade target and a clear delta from their current version.  
**Canonical spec:** [config-reference-mvp.md](config-reference-mvp.md) · **Install patterns:** [oss-consumption.md](oss-consumption.md)

**Target version:** `**^0.1.5`** for all published packages you depend on (`**@restormel/testing-bundle`**, `**@restormel/testing-cli**`, `**@restormel/testing-github-action**`, and any direct `**@restormel/testing-***` peers).

**Why 0.1.5:** Tag `**testing-v0.1.4`** put most packages at **0.1.4** on npm but left `**@restormel/testing-cli`** and `**@restormel/testing-keys-adapter`** at **0.1.3** in that tree — a **split line**. **0.1.5** republishes the **entire** line at one version. Prefer `**^0.1.5`** over staying on `**^0.1.4`**.

---

## 1. Upgrade paths (by the version you have today)

Use this table to see **what you skip over** when you jump straight to **0.1.5**, then read the subsection for your **current** line for breaking or opt-in changes.


| Current line    | Jump to **0.1.5**              | In one sentence                                                                                                                                                                                                 |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0.1.1**       | One bump                       | You gain **0.1.2** agent missions, **0.1.3** business acceptance + reporting + `--ac`, **0.1.4** optional `**ac_sequence`**, and 0.1.5 aligned CLI/adapter + `**RESTORMEL_KEYS_BASE`** / Gateway bearer parity. |
| **0.1.2**       | One bump                       | You gain **0.1.3** BA fields and `**acceptanceResults`**, 0.1.4 `**ac_sequence`**, and **0.1.5** line alignment + Keys env parity.                                                                              |
| **0.1.3**       | One bump                       | You gain **0.1.4** `**ac_sequence`** (optional) and **0.1.5** full npm alignment + Keys env / `**testing doctor`** parity.                                                                                      |
| **0.1.4** (npm) | **Strongly** move to **0.1.5** | You fix the **split registry** (CLI + keys-adapter were not at **0.1.4** with peers) and pick up the same Keys/CLI tweaks shipped in the **0.1.5** train.                                                       |


### 1.1 From **0.1.1**

- **What 0.1.1 was:** Registry alignment after the initial **0.1.0** train; `**@restormel/testing-bundle`** included in the same publish set so consumers can use one devDependency.
- **Upgrade to 0.1.5:** Bump `**@restormel/testing-bundle`** (or CLI + peers) to `**^0.1.5`**, refresh lockfile, reinstall Playwright browsers if your CI image changed.
- **Config / CI:** No change required if you only use default `**execution_mode: observe`** goals and never adopted newer YAML keys. Everything below is **additive** unless you opt in.

### 1.2 From **0.1.2**

- **What 0.1.2 added:** `**execution_mode: agent`** for `**type: browser`**: `**mission**`, `**mission_executor**`, optional `**mission_constraints**`, `**after_agent**`; runner runs the shell first, then Playwright + `**success_criteria**`; `**RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1**`; `**testing doctor**` Keys probe uses bootstrap ref `**ref:restormel-keys:llm/primary**` with clearer HTTP hints.
- **Upgrade to 0.1.5:** Same as §1.1, plus:
  - If you **already** use **agent** goals: no rename breaks; **0.1.3+** adds optional mission env `**RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON`** / `**RESTORMEL_TESTING_USER_STORY`** when the suite declares BA fields (safe to ignore if you do not add them).
  - **Doc:** [agent-missions.md](agent-missions.md).

### 1.3 From **0.1.3**

- **What 0.1.3 added:** Suite `**user_story` / `userStory`** and `**acceptance_criteria` / `acceptanceCriteria`** (`{ id, text }[]`); per-goal `**acceptance_criterion_ids` / `acceptanceCriterionIds**`; `**RunRecord.acceptanceResults**`; CLI `**testing run … --ac <id>**`; reports (Markdown, GitHub summary, `**report.json**`) include story + AC table; agent `**mission_executor**` receives `**RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON**` when the suite defines criteria.
- **Upgrade to 0.1.5:** Same as §1.1, plus:
  - **Validation:** If you set `**acceptance_criterion_ids`** on a goal, the suite **must** declare `**acceptance_criteria`** (ids must exist). If you omit BA fields entirely, behaviour stays like older observe-only configs.
  - **Consumers of `run.json` / `report.json`:** New optional top-level / nested fields (e.g. `**acceptanceResults`**, suite slice with story + criteria). Parsers should **tolerate unknown keys** or read the new shapes per [config-reference-mvp.md](config-reference-mvp.md).
  - **Example:** [examples/testing-business-acceptance/restormel-testing.yaml](../../examples/testing-business-acceptance/restormel-testing.yaml).

### 1.4 From **0.1.4** (npm)

- **What 0.1.4 added (runner/config/core):** `**execution_mode: ac_sequence`**: built-in multi-turn LLM browser agent over suite `**acceptance_criteria`**; optional `**criterion_success**`, `**criterion_rubrics**` (judge JSON must include matching `**ac_id**`), `**post_checks**` (HTTP, DOM `**dom_role_name**`, `**db_shell**`), `**criterion_executor**`; `**GoalRunRecord.acSequenceSteps**`; roll-up prefers step-level verdicts when present; goal may omit / empty top-level `**success_criteria**` in this mode; default `**acceptance_criterion_ids**` = all suite AC ids when omitted.
- **Registry caveat:** On npm, **CLI** and **keys-adapter** did not all publish at **0.1.4** together with the rest of the line — **do not** standardise on `**^0.1.4`** as a “single version”.
- **Upgrade to 0.1.5:** Bump everything to `**^0.1.5`** so CLI, adapter, runner, config, and reports match. If you started using `**ac_sequence`**, no YAML renames are required for **0.1.5** (same contract).

---

## 2. What to change in your repo (target **0.1.5**)


| Action                   | Detail                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Bump devDependencies** | Prefer `**pnpm add -D @restormel/testing-bundle@^0.1.5`** (or bump `**@restormel/testing-cli`** and every direct `**@restormel/testing-***` dependency to `**^0.1.5**`). |
| **Playwright**           | Still install browsers for the adaptor (e.g. `**pnpm exec playwright install chromium`**) per [oss-consumption.md](oss-consumption.md).                                  |
| **GitHub Action**        | Pin or reinstall `**@restormel/testing-github-action`** at `**^0.1.5`**.                                                                                                 |
| **Lockfile**             | Run install and commit `**pnpm-lock.yaml`** (or npm/yarn equivalent).                                                                                                    |


---

## 3. Cumulative feature reference (by release)

Use this as a checklist of **what exists in 0.1.5** and which train introduced it.

### Shipped in **0.1.2**

- `**execution_mode: agent`**: `**mission`**, `**mission_executor**`, optional `**mission_constraints**`, `**after_agent**`; post-mission browser evaluation.
- `**RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1**`.
- `**testing doctor**`: Keys resolve probe + clearer 404 vs 401/403 messaging.

### Shipped in **0.1.3**

- Suite **BA** fields and goal `**acceptance_criterion_ids`**; `**--ac`** CLI filter; `**acceptanceResults**` in `**RunRecord**` and reports.
- `**RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON**` / `**RESTORMEL_TESTING_USER_STORY**` for `**mission_executor**` when the suite defines them.

### Shipped in **0.1.4** (config + runner)

- `**execution_mode: ac_sequence`** and `**ac_sequence`** goal block (see §1.4).
- `**acSequenceSteps**` on goal runs; per-AC hooks and optional empty top-level `**success_criteria**` for that mode.

### Shipped in **0.1.5** (npm + adapter + CLI)

- **Full package line** at **0.1.5** on npm (fixes split **0.1.4** CLI/adapter).
- `**RESTORMEL_KEYS_BASE`** for resolve base URL when `**RESTORMEL_KEYS_API_BASE_URL`** is unset.
- Resolve bearer order: optional `**RESTORMEL_KEYS_API_TOKEN_ENV**`, then `**RESTORMEL_KEYS_API_TOKEN**`, `**RESTORMEL_GATEWAY_KEY**`, `**RESTORMEL_SERVER_TOKEN**`.
- `**testing doctor**` behaviour matches `**@restormel/testing-keys-adapter**`.

---

## 4. Environment variables (quick reference)


| Variable                                                                                                                           | When                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `**RESTORMEL_TESTING_USER_STORY**`, `**RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON**`                                               | `**mission_executor**` when the suite has a user story / acceptance criteria (JSON: `{ userStory, acceptanceCriteria }`). **Since 0.1.3.** |
| `**RESTORMEL_TESTING_MISSION`**, `**RESTORMEL_TESTING_BASE_URL`**, `**RESTORMEL_TESTING_GOAL_ID**`, `**RESTORMEL_TESTING_RUN_ID**` | Agent mission phase. **Since 0.1.2.**                                                                                                      |
| `**RESTORMEL_TESTING_AC_ID`**, `**RESTORMEL_TESTING_AC_TEXT`**, `**RESTORMEL_TESTING_AC_INDEX**`                                   | `**ac_sequence**` hooks: `**criterion_executor**`, `**post_checks.db_shell**`. **Since 0.1.4.**                                            |


Shell hook skip/timeout: `**RESTORMEL_TESTING_SKIP_SHELL_HOOKS`**, `**RESTORMEL_TESTING_SHELL_HOOK_TIMEOUT_MS`**.

---

## 5. Documentation map


| Topic                                        | Where                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Full YAML + validation rules                 | [config-reference-mvp.md](config-reference-mvp.md)                                 |
| Agent missions (external executor)           | [agent-missions.md](agent-missions.md)                                             |
| npm / CI install                             | [oss-consumption.md](oss-consumption.md)                                           |
| Broader Plot-style MVP delta (tables, links) | [release-notes-plot-engineers-2026-04.md](release-notes-plot-engineers-2026-04.md) |
| Publish / tag (maintainers)                  | [npm-publish-checklist.md](npm-publish-checklist.md)                               |


Live dashboard guides: **[https://restormel.dev/testing/docs/](https://restormel.dev/testing/docs/)**.

---

## 6. Publish status

**npm:** Tag `**testing-v0.1.5`** (or **[Publish Testing packages](https://github.com/Allotment-Technology-Ltd/restormel-keys/actions)** `workflow_dispatch`) with `**NPM_TOKEN`**. Verify with `**npm view @restormel/testing-cli version`** and `**npm view @restormel/testing-bundle version**` (`**0.1.5**`).