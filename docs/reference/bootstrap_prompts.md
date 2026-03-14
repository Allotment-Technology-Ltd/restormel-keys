# Restormel Keys — Phase 00 Bootstrap Prompts

## Purpose

This document is the prompt companion to `docs/bootstrap-plan.md`.

It exists to help drive the **actual Cursor execution flow** for Restormel Keys Phase 00.

Use this alongside the bootstrap plan, not instead of it.

### Operating rule

Before Cursor generates, edits, scaffolds, or restructures anything for Phase 00, it should first:

1. inspect the repository
2. read `docs/bootstrap-plan.md`
3. treat that document as the controlling Phase 00 plan
4. identify any gaps between current repo state and the agreed target state
5. only then propose or implement bootstrap changes

This prompts document is designed to keep execution:

- aligned with the bootstrap plan
- narrow and deterministic
- safe for a BYOK product path
- efficient on limited Cursor Pro credits
- resistant to prompt sprawl and repo drift

---

## How to use this document

Use the prompts in this order unless there is a very good reason not to:

1. **Master bootstrap prompt**
2. **Repo audit / gap prompt**
3. **Rules generation prompts**
4. **Skills generation prompts**
5. **Subagents generation prompts**
6. **Scripts / CI / templates prompts**
7. **Canonical docs generation prompts**
8. **Final audit / readiness prompts**

Do not jump straight to later prompts if the repository has not first been compared against `docs/bootstrap-plan.md`.

---

## Prompt usage discipline

Before using any prompt in this file:

- keep the task narrow
- name exact files where possible
- prefer edits to rewrites
- avoid repo-wide refactors
- avoid product logic during Phase 00
- prefer scripts and templates over long agent reasoning
- use Plan Mode for any non-trivial task

If a prompt starts producing broad speculative output, stop and narrow the scope.

---

# 1. Master bootstrap prompt

Use this first.

```text
You are bootstrapping the Restormel Keys repository for Phase 00.

Before doing anything else:
1. inspect the repository as it currently exists
2. read docs/bootstrap-plan.md in full
3. treat docs/bootstrap-plan.md as the controlling Phase 00 plan
4. identify the current repo state versus the target bootstrap state described there
5. only then propose and implement the smallest high-value set of bootstrap changes

Mission:
Create the pre-coding operating system for the repo so implementation can begin safely and efficiently afterward.

Important context:
- Restormel Keys is a library-first BYOK and provider-routing product.
- The headless core is the product; UI wrappers are delivery mechanisms.
- We are in Phase 00 bootstrap mode.
- Do not implement product or business logic yet.
- Optimize for security, reliability, safe UX, strong docs, and limited Cursor Pro credits.
- Prefer the smallest setup that gives strong governance and safe forward motion.

Required working method:
- Use Plan Mode before making non-trivial changes.
- Mark assumptions clearly.
- Separate confirmed decisions from provisional decisions.
- Prefer exact file creation/edits over broad rewrites.
- Prefer scripts/hooks/CI for repeatable checks.
- Avoid full-repo rewrites or speculative architecture expansion.

Tasks:
1. Inspect current repo contents.
2. Read and summarize the key instructions from docs/bootstrap-plan.md that should govern this run.
3. Identify what already exists that should be preserved.
4. Identify what is missing.
5. Propose a minimal Phase 00 target diff.
6. Implement the agreed bootstrap scaffolding:
   - root docs
   - docs/ canonical package
   - .cursor/rules/
   - skills/
   - subagents/
   - scripts/
   - .github/workflows and templates
   - prompts/ classification folders
7. Keep all work aligned to docs/bootstrap-plan.md.
8. Do not add product/business logic.
9. At the end, output:
   - files created
   - files updated
   - assumptions
   - open questions
   - blockers before Phase 01

Success criteria:
- the repo is more complete, more governed, and safer than before
- no meaningful product logic has been added
- the output remains lean and practical
```

---

# 2. Repo audit / gap prompts

## 2.1 Repo structure gap audit

```text
Inspect the current Restormel Keys repository and compare it against docs/bootstrap-plan.md.

Before anything else:
- read docs/bootstrap-plan.md in full
- use it as the source of truth for the target Phase 00 structure

Then produce a concise audit with these sections:
- existing bootstrap assets to keep
- missing required files/folders
- misplaced or duplicate files
- prompt-governance risks
- documentation gaps
- security/reliability governance gaps
- recommended next actions in priority order

Do not implement fixes yet.
Keep the output short, concrete, and repo-specific.
```

## 2.2 Minimal bootstrap diff prompt

```text
Read docs/bootstrap-plan.md first.

Then identify the smallest high-value bootstrap diff needed right now for the Restormel Keys repo.

Output only:
- files/folders to create now
- files to defer until later
- anything that should be removed, moved, or archived
- a short rationale for each recommendation

Optimize for:
- safe forward progress this month
- limited Cursor Pro credits
- avoiding overbuild
```

---

# 3. Rules generation prompts

Generate rules only after reading `docs/bootstrap-plan.md`.

## 3.1 Generate all rules

```text
Read docs/bootstrap-plan.md first and use it as the controlling specification.

Generate the Restormel Keys Phase 00 rule set under .cursor/rules/.

Create these files:
- 00-bootstrap-gate.mdc
- 01-doc-governance.mdc
- 02-security-baseline.mdc
- 03-quality-and-testing.mdc
- 04-ux-safety.mdc
- 05-prompt-governance.mdc
- 06-credit-efficiency.mdc

Requirements:
- rules must be concise, strict, and operational
- rules must support security, reliability, safe UX, documentation governance, and credit efficiency
- rules must align to docs/bootstrap-plan.md
- rules must avoid generic filler
- rules must be appropriate for a lean Phase 00 bootstrap

After generating them, provide a short summary of what each rule enforces.
```

## 3.2 Refine one rule only

```text
Read docs/bootstrap-plan.md first.

Then review and improve this single rule file only: [INSERT RULE FILE]

Requirements:
- keep the intent aligned to docs/bootstrap-plan.md
- make it sharper and more enforceable
- remove vague wording
- do not expand scope unnecessarily
- preserve brevity

Return:
- revised rule text
- a short note explaining what changed
```

---

# 4. Skills generation prompts

Generate skills only after reading `docs/bootstrap-plan.md`.

## 4.1 Generate all bootstrap skills

```text
Read docs/bootstrap-plan.md first and use it as the controlling Phase 00 plan.

Generate the Restormel Keys bootstrap skills under skills/.

Create these skills:
- skill-installer
- repo-bootstrapper
- docs-maintainer
- roadmap-status-sync
- changelog-updater
- prompt-librarian
- security-review
- architecture-recorder
- release-prep

For each skill, include:
- purpose
- when to use it
- inputs
- workflow
- outputs
- done criteria
- how it saves credits or reduces mistakes

Requirements:
- keep each skill narrow and reusable
- align to docs/bootstrap-plan.md
- avoid overlap between skills where possible
- do not create product logic
```

## 4.2 Generate skill-installer only

```text
Read docs/bootstrap-plan.md first.

Generate the skill-installer skill for Restormel Keys.

It must support:
- listing curated installable skills
- installing curated skills
- installing from GitHub repo paths, including private repos already accessible to the user
- using helper scripts where useful
- installing into $CODEX_HOME/skills
- reminding the user to restart Codex after install

Make it practical, deterministic, and concise.
```

## 4.3 Refine one skill only

```text
Read docs/bootstrap-plan.md first.

Review and improve this single skill only: [INSERT SKILL NAME OR FILE]

Requirements:
- align to docs/bootstrap-plan.md
- narrow the skill if it is too broad
- reduce overlap with other skills
- improve inputs, outputs, and done criteria
- preserve credit-efficiency discipline

Return:
- revised skill content
- short explanation of improvements
```

---

# 5. Subagents generation prompts

Generate subagents only after reading `docs/bootstrap-plan.md`.

## 5.1 Generate all subagents

```text
Read docs/bootstrap-plan.md first and use it as the controlling Phase 00 plan.

Generate the Restormel Keys bootstrap subagents under subagents/.

Create these subagents:
- repo-auditor
- docs-maintainer
- security-reviewer
- test-designer
- prompt-librarian
- release-readiness-checker

For each subagent, include:
- narrow purpose
- inputs
- outputs
- handoff boundaries
- when not to use it
- how it reduces context pollution and credit waste

Requirements:
- keep the set intentionally small
- avoid overlap with skills
- do not create general-purpose subagents
- align everything to docs/bootstrap-plan.md
```

## 5.2 Refine one subagent only

```text
Read docs/bootstrap-plan.md first.

Review and improve this single subagent only: [INSERT SUBAGENT FILE]

Requirements:
- align to docs/bootstrap-plan.md
- make the boundary narrower and clearer
- reduce overlap with skills or rules
- make the output more actionable
- keep it small and specialist
```

---

# 6. Scripts, CI, and templates prompts

Generate scripts and workflows only after reading `docs/bootstrap-plan.md`.

## 6.1 Generate all scripts

```text
Read docs/bootstrap-plan.md first and use it as the controlling Phase 00 plan.

Generate these scripts under scripts/:
- review-docs.sh
- docs-update-checklist.sh
- check-repo-hygiene.sh
- check-secrets.sh
- check-dependency-policy.sh

Requirements:
- keep scripts lightweight and portable
- prefer bash with minimal dependencies
- fail clearly with actionable messages where blocking behavior is intended
- keep them Phase 00 appropriate
- align them to the checks described in docs/bootstrap-plan.md

Also provide a short note explaining when each script should run.
```

## 6.2 Generate workflows and templates

```text
Read docs/bootstrap-plan.md first.

Generate the minimum GitHub scaffolding for Restormel Keys Phase 00:
- .github/workflows/ci.yml
- .github/workflows/docs.yml
- .github/workflows/repo-hygiene.yml
- .github/pull_request_template.md
- issue templates for bug, feature, and task

Requirements:
- workflows should be lean and fast
- they should run the bootstrap scripts where relevant
- do not add heavyweight tooling without clear need
- keep everything aligned to docs/bootstrap-plan.md
```

## 6.3 Refine one script or workflow only

```text
Read docs/bootstrap-plan.md first.

Review and improve this single file only: [INSERT FILE PATH]

Requirements:
- keep it aligned to docs/bootstrap-plan.md
- simplify where possible
- improve clarity, determinism, and usefulness
- avoid adding unnecessary complexity or dependencies
```

---

# 7. Canonical docs generation prompts

Generate docs only after reading `docs/bootstrap-plan.md`.

## 7.1 Generate canonical docs package

```text
Read docs/bootstrap-plan.md first and use it as the controlling Phase 00 plan.

Generate or update the canonical Phase 00 docs package for Restormel Keys.

Create or update:
- README.md
- ROADMAP.md
- STATUS.md
- CHANGELOG.md
- CONTRIBUTING.md
- ARCHITECTURE.md
- docs/bootstrap-checklist.md
- docs/working-agreement.md
- docs/security-baseline.md
- docs/threat-model-starter.md
- docs/reliability-standards.md
- docs/testing-strategy.md
- docs/release-readiness.md
- docs/prompts-reference.md
- docs/prompt-governance.md
- docs/skills.md
- docs/subagents.md
- docs/runbooks.md
- docs/decisions/README.md
- docs/archive/README.md

Requirements:
- one canonical source of truth per topic
- no duplicated operational truth across multiple docs
- concise implementation-oriented language
- clear separation of confirmed decisions vs provisional decisions where relevant
- align all docs to docs/bootstrap-plan.md
- do not add product logic
```

## 7.2 Generate one doc only

```text
Read docs/bootstrap-plan.md first.

Generate or improve this single document only: [INSERT FILE PATH]

Requirements:
- align it to docs/bootstrap-plan.md
- keep it concise and operational
- avoid duplicating truth from other canonical docs
- include maintenance expectations where useful
```

## 7.3 Sync docs after repo changes

```text
Read docs/bootstrap-plan.md first.

Review the current repo changes and identify which canonical docs now need updating.

Output:
- docs that must be updated now
- docs that may need later updates
- exact sections likely affected
- concise rationale

Do not make edits yet.
```

---

# 8. Prompt governance prompts

## 8.1 Inventory prompt files

```text
Read docs/bootstrap-plan.md first.

Then inventory all prompt files in the Restormel Keys repo and classify each as:
- canonical
- reference
- archive

Output:
- file path
- class
- purpose
- owner or implied owner
- any duplication or conflict risk
- whether it should remain a prompt or be promoted to a Skill, Rule, or Subagent

Keep the output concise and repo-specific.
```

## 8.2 Govern the existing prompt packs

```text
Read docs/bootstrap-plan.md first.

Review the existing Restormel Keys prompt pack files and decide how they should be governed during Phase 00.

Requirements:
- do not assume all prompt packs are canonical
- classify them appropriately
- explain which should remain reference material for now
- identify any fragments that should be promoted into canonical prompts, Rules, Skills, or Subagents
- align recommendations to docs/bootstrap-plan.md
```

---

# 9. Final audit and readiness prompts

## 9.1 Final repo audit

```text
Read docs/bootstrap-plan.md first.

Audit the current Restormel Keys repo against the target Phase 00 state described there.

Return:
- what is complete
- what is partially complete
- what is missing
- what is out of scope but accidentally added
- the top 5 actions needed to complete Phase 00

Keep it concise and decisive.
```

## 9.2 Phase 00 readiness check

```text
Read docs/bootstrap-plan.md first.

Evaluate whether Restormel Keys Phase 00 is complete.

Use the acceptance criteria in docs/bootstrap-plan.md.

Return:
- pass / fail for each checklist area
- blockers
- recommended next action order
- whether the bootstrap gate should remain active or can be lifted

Do not suggest product implementation until the checklist genuinely passes.
```

## 9.3 Bootstrap gate lift recommendation

```text
Read docs/bootstrap-plan.md first.

Based on the current repo state, should the Phase 00 bootstrap gate remain active?

Return:
- yes or no
- the evidence for the decision
- what must still be completed before Phase 01 implementation starts safely

Keep the answer strict and practical.
```

---

# 10. Fast-use short prompts

## 10.1 Before-you-code prompt

```text
Before doing any work, read docs/bootstrap-plan.md and summarize:
- the current Phase 00 constraints
- what is in scope
- what is out of scope
- which canonical docs are most relevant to this task
Then wait for the next instruction.
```

## 10.2 Narrow edit prompt

```text
Read docs/bootstrap-plan.md first.
Then make the smallest useful edit to [INSERT FILE] to achieve [INSERT GOAL].
Do not rewrite unrelated sections.
Explain exactly what changed.
```

## 10.3 Small-slice scaffold prompt

```text
Read docs/bootstrap-plan.md first.
Then scaffold only this small slice of Phase 00 work: [INSERT SLICE].
Keep the implementation minimal, aligned to the plan, and free of product logic.
Return created/updated files only.
```

---

# 11. Recommended repo placement

Recommended file path for this document:

- `docs/bootstrap-prompts.md`

This should sit alongside:

- `docs/bootstrap-plan.md`
- `docs/bootstrap-checklist.md`
- `docs/prompt-governance.md`
- `docs/prompts-reference.md`

---

# 12. Maintenance note

Keep this file tight.

If a prompt becomes a repeated workflow, convert it into a Skill. If a prompt becomes stable repo law, convert it into a Rule. If a prompt becomes a narrow specialist review role, convert it into a Subagent.

This file should remain a **practical execution companion** to `docs/bootstrap-plan.md`, not a second competing strategy document.

