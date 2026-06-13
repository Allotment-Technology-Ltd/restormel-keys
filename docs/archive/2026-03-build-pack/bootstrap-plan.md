# Restormel Keys — Phase 00 Bootstrap Plan

## Purpose

This document defines the **Phase 00** setup for the Restormel Keys repository.

Phase 00 exists to create the pre-coding operating system for the repo so that implementation can begin with:

- secure-by-design defaults
- high-quality engineering guardrails
- reliable production intent
- safe user experience expectations
- strong documentation governance
- efficient use of limited Cursor Pro credits

This phase is intentionally focused on **repository foundation, governance, safety, and workflow design**. It does **not** begin product or business logic.

---

## Executive summary

Restormel Keys should begin with a **lean but strict bootstrap layer**: a monorepo skeleton, canonical docs, a small set of Cursor rules, a repeatable skills layer, a very small specialist subagent set, and cheap local/CI enforcement.

This is the right fit for Restormel Keys because the project is already clearly framed as:

- a **library-first** BYOK and provider-routing product
- a product where the **headless core is the product**
- a product that needs to ship safely and credibly without heavyweight default infrastructure
- a product that must stay sharply scoped and commercially viable

The setup optimizes for:

- getting to implementation quickly without chaos
- reducing security mistakes around BYOK flows
- preventing scope drift
- preserving a single source of truth per topic
- using Cursor for high-value work instead of wasting credits on repeated repo-wide reasoning

The main risks this Phase 00 setup is designed to prevent are:

- premature implementation without architecture or safety guardrails
- insecure defaults around API keys and secret handling
- prompt sprawl and duplicated repo truth
- excessive agent-led rewrites that burn credits without improving readiness
- documentation drift between roadmap, status, architecture, and prompts

---

## What the current project context suggests

### Confirmed from project context

Restormel Keys is a standalone product and the first revenue product in the wider Restormel family.

Its product shape is already strongly implied:

- `@restormel/keys` headless core
- Svelte UI as reference implementation
- Web Components / Elements layer for broad embedding
- React wrapper as a thin adapter
- CLI package
- later dashboard, docs/site, billing, and hosted flows

Its intended repo shape is also already clear:

- separate repository
- pnpm workspace / monorepo
- packages, apps, docs, infra, scripts, and CI

The project context also indicates that:

- the headless core is the real product
- UI wrappers are delivery mechanisms
- Next.js / React compatibility is especially important early
- security, billing, and infra patterns may selectively reuse proven SOPHIA patterns where useful
- the product should stay lightweight and not drift into a generic gateway or generic observability product

### Likely constraints

- limited time to get to a credible first shipping slice this month
- limited Cursor Pro credits
- need for strong documentation and prompt governance before implementation begins
- need for a practical, non-bloated security baseline suited to BYOK and hosted SaaS-style risks

### Likely risk areas

- raw key leakage in logs, docs, fixtures, screenshots, or examples
- architecture drift away from “headless core is the product”
- prompt packs becoming conflicting sources of truth
- overbuilding infra before core package contracts are stable
- weak UX defaults for destructive actions, privacy-sensitive flows, and degraded states

### What matters most in Phase 00

1. repo structure
2. canonical docs
3. prompt governance
4. Cursor rules and working agreements
5. cheap enforcement through scripts and CI
6. a practical security and reliability baseline
7. a clear definition of bootstrap completion

### Assumptions

- The repo is in early bootstrap mode and may not yet have the final structure.
- Cursor will be the main implementation environment.
- The immediate goal is to make implementation safe and efficient, not to gold-plate internal process.

### Unknowns to confirm later

- exact current repo state
- whether real infra accounts and secrets systems are already ready
- whether dashboard/site placeholders should remain empty or include shell scaffolds
- whether all later hosted components are needed for the first live slice or whether the initial launch can bias toward packages/examples first

---

## Phase 00 objectives

### In scope

Phase 00 must establish:

#### 1. Repository foundation

- lean monorepo structure aligned to the package/app plan
- root config files and workspace scaffolding
- folder placeholders where needed

#### 2. Documentation system

- one canonical source of truth per topic
- clear separation between canonical, reference, and archive material
- maintenance expectations from the start

#### 3. Cursor operating system

- stable Rules for repo law and guardrails
- Skills for repeatable workflows
- a very small Subagent set for narrow specialist reviews only
- required Plan Mode before non-trivial work

#### 4. Security baseline

- BYOK-safe defaults
- secrets handling rules
- trust-boundary starter
- banned anti-patterns

#### 5. Reliability baseline

- structured logging expectations
- failure-mode and rollback expectations
- release-readiness and operational-readiness stubs

#### 6. UX safety baseline

- privacy-sensitive and destructive flow expectations
- accessibility minimums
- clear degraded-mode behavior expectations

#### 7. Hooks, scripts, and CI

- cheap deterministic checks
- docs checks
- secret scanning
- dependency policy checks
- repo hygiene checks

#### 8. Release readiness

- status, roadmap, changelog, and readiness docs
- a clear gate for moving into Phase 01 implementation

#### 9. Cost efficiency

- small rule set
- small skill set
- fewer subagents than seems tempting
- shell-scripted checks wherever practical

### Explicitly out of scope

Phase 00 does **not** include:

- provider adapter implementation
- routing or entitlement business logic
- key wallet implementation
- hosted proxy/gateway logic
- dashboard application logic
- billing logic
- production deployment
- deep end-to-end test suites
- broad speculative platform expansion

---

## Final recommended Phase 00 architecture

### Root docs

Keep only the most important project entry points at the root:

- `README.md`
- `ROADMAP.md`
- `STATUS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `ARCHITECTURE.md`

These are the first-level navigation files. Everything else should live under `docs/`.

### Canonical docs package under `docs/`

Recommended Phase 00 docs:

- `docs/bootstrap-plan.md`
- `docs/bootstrap-checklist.md`
- `docs/working-agreement.md`
- `docs/security-baseline.md`
- `docs/threat-model-starter.md`
- `docs/reliability-standards.md`
- `docs/testing-strategy.md`
- `docs/release-readiness.md`
- `docs/prompts-reference.md`
- `docs/prompt-governance.md`
- `docs/skills.md`
- `docs/subagents.md`
- `docs/runbooks.md`
- `docs/decisions/README.md`
- `docs/archive/README.md`

### Cursor rules

Use a small, stable rules set:

- `00-bootstrap-gate.mdc`
- `01-doc-governance.mdc`
- `02-security-baseline.mdc`
- `03-quality-and-testing.mdc`
- `04-ux-safety.mdc`
- `05-prompt-governance.mdc`
- `06-credit-efficiency.mdc`

### Skills

Recommended initial skills:

- `skill-installer`
- `repo-bootstrapper`
- `docs-maintainer`
- `roadmap-status-sync`
- `changelog-updater`
- `prompt-librarian`
- `security-review`
- `architecture-recorder`
- `release-prep`

### Subagents

Use a very small set only:

- `repo-auditor`
- `docs-maintainer`
- `security-reviewer`
- `test-designer`
- `prompt-librarian`
- `release-readiness-checker`

### Scripts

Keep scripts cheap and deterministic:

- `scripts/review-docs.sh`
- `scripts/docs-update-checklist.sh`
- `scripts/check-repo-hygiene.sh`
- `scripts/check-secrets.sh`
- `scripts/check-dependency-policy.sh`

### GitHub scaffolding

Recommended minimum:

- `.github/workflows/ci.yml`
- `.github/workflows/docs.yml`
- `.github/workflows/repo-hygiene.yml`
- `.github/pull_request_template.md`
- issue templates for bug, feature, and task

### Prompt library

Use a three-way prompt classification:

- `prompts/canonical/`
- `prompts/reference/`
- `prompts/archive/`

Do not treat every prompt pack file as canonical truth.

---

## Final recommended Phase 00 repository tree

```text
restormel-keys/
├─ .cursor/
│  └─ rules/
│     ├─ 00-bootstrap-gate.mdc
│     ├─ 01-doc-governance.mdc
│     ├─ 02-security-baseline.mdc
│     ├─ 03-quality-and-testing.mdc
│     ├─ 04-ux-safety.mdc
│     ├─ 05-prompt-governance.mdc
│     └─ 06-credit-efficiency.mdc
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml
│  │  ├─ docs.yml
│  │  └─ repo-hygiene.yml
│  ├─ ISSUE_TEMPLATE/
│  │  ├─ bug_report.md
│  │  ├─ feature_request.md
│  │  └─ task.md
│  └─ pull_request_template.md
├─ apps/
│  ├─ dashboard/
│  │  └─ .gitkeep
│  ├─ demo-next/
│  │  └─ .gitkeep
│  └─ site/
│     └─ .gitkeep
├─ docs/
│  ├─ decisions/
│  │  └─ README.md
│  ├─ archive/
│  │  └─ README.md
│  ├─ bootstrap-plan.md
│  ├─ bootstrap-checklist.md
│  ├─ working-agreement.md
│  ├─ security-baseline.md
│  ├─ threat-model-starter.md
│  ├─ reliability-standards.md
│  ├─ testing-strategy.md
│  ├─ release-readiness.md
│  ├─ prompts-reference.md
│  ├─ prompt-governance.md
│  ├─ skills.md
│  ├─ subagents.md
│  └─ runbooks.md
├─ packages/
│  ├─ core/
│  │  └─ .gitkeep
│  ├─ svelte/
│  │  └─ .gitkeep
│  ├─ elements/
│  │  └─ .gitkeep
│  ├─ react/
│  │  └─ .gitkeep
│  └─ cli/
│     └─ .gitkeep
├─ prompts/
│  ├─ canonical/
│  ├─ reference/
│  └─ archive/
├─ scripts/
│  ├─ review-docs.sh
│  ├─ docs-update-checklist.sh
│  ├─ check-repo-hygiene.sh
│  ├─ check-secrets.sh
│  └─ check-dependency-policy.sh
├─ skills/
│  ├─ skill-installer/
│  ├─ repo-bootstrapper/
│  ├─ docs-maintainer/
│  ├─ roadmap-status-sync/
│  ├─ changelog-updater/
│  ├─ prompt-librarian/
│  ├─ security-review/
│  ├─ architecture-recorder/
│  └─ release-prep/
├─ subagents/
│  ├─ repo-auditor.md
│  ├─ docs-maintainer.md
│  ├─ security-reviewer.md
│  ├─ test-designer.md
│  ├─ prompt-librarian.md
│  └─ release-readiness-checker.md
├─ .gitignore
├─ .npmrc
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
├─ README.md
├─ ROADMAP.md
├─ STATUS.md
├─ CHANGELOG.md
├─ CONTRIBUTING.md
└─ ARCHITECTURE.md
```

---

## Cursor operating model

### What Rules are responsible for

Rules are repo law. They should be stable, small, and enforcement-oriented. They should control:

- scope discipline
- documentation governance
- security minimums
- testing / quality expectations
- safe UX expectations
- prompt governance
- credit-efficiency discipline

### What Skills are responsible for

Skills package repeatable workflows. They should be used for multi-step tasks that recur, such as:

- bootstrap scaffolding
- docs maintenance
- roadmap/status/changelog sync
- prompt inventory and governance
- security review
- architecture decision recording
- release preparation

### What Subagents are responsible for

Subagents are for narrow specialist passes only. Use them when their specialist boundary is clear enough that they reduce total context and save credits. Do not use them for routine file generation.

### When Plan Mode should be mandatory

Plan Mode should be mandatory for:

- any task touching more than 3 files
- any CI/workflow setup
- any Rule / Skill / Subagent generation work
- any security-sensitive change
- any repo-structure change

### When hooks/scripts should be used instead of agent reasoning

Use scripts for:

- checking required files
- checking docs presence and simple linkage
- checking repo hygiene
- detecting obvious secret leakage
- checking package/dependency policy

### How to keep context narrow

- work one vertical slice at a time
- name exact target files
- update the canonical doc, not every related doc
- edit instead of rewrite wherever possible
- do not ask Cursor to “improve the whole repo”

### How to avoid credit waste

- use the smallest useful prompt
- avoid duplicate review passes
- do not create too many subagents
- prefer deterministic scripts to repeated reasoning
- do not run broad audits until enough code exists to justify them

---

## Final recommended Cursor rules

### 1. `00-bootstrap-gate.mdc`

**Purpose**\
Prevent premature product implementation during Phase 00.

**Mode**\
Always-on.

**Must enforce**

- Phase 00 is bootstrap only
- no provider logic, billing logic, or hosted product logic yet
- only scaffolding, docs, rules, skills, subagents, scripts, workflows, templates, and placeholders are allowed
- Plan Mode is required before non-trivial bootstrap work

**Prevents**

- jumping into business logic because the roadmap already exists
- losing time to implementation before guardrails exist

### 2. `01-doc-governance.mdc`

**Purpose**\
Treat docs as infrastructure.

**Mode**\
Always-on.

**Must enforce**

- one canonical source of truth per topic
- canonical vs reference vs archive distinction
- required updates to status/roadmap/changelog/architecture/security docs when process or structure changes

**Prevents**

- duplicated truth
- prompt docs quietly becoming authoritative without governance

### 3. `02-security-baseline.mdc`

**Purpose**\
Establish BYOK-safe defaults from day zero.

**Mode**\
Always-on.

**Must enforce**

- no committed secrets
- no raw key logging
- no unsafe placeholder secrets normalized in docs or code
- redaction and data minimisation expectations
- trust-boundary thinking for sensitive changes

**Prevents**

- the worst early security mistakes in a BYOK repo

### 4. `03-quality-and-testing.mdc`

**Purpose**\
Maintain a cheap confidence baseline.

**Mode**\
Always-on.

**Must enforce**

- narrow, testable changes
- deterministic checks before long reasoning
- lint/typecheck/doc checks where relevant
- CI-friendly scripts for repeated validations

**Prevents**

- speculative edits with no verification
- high-credit low-confidence work

### 5. `04-ux-safety.mdc`

**Purpose**\
Set expectations for safe user-facing behavior.

**Mode**\
Scoped but widely applicable.

**Must enforce**

- clear loading/error/empty/success states
- destructive action confirmation
- privacy-sensitive messaging around key handling
- accessibility basics
- degraded-mode consideration

**Prevents**

- unsafe or opaque UX defaults later

### 6. `05-prompt-governance.mdc`

**Purpose**\
Govern prompt assets.

**Mode**\
Always-on.

**Must enforce**

- prompt classes: canonical, reference, archive
- ownership and purpose for prompt files
- repeated workflows upgraded to Skills where appropriate
- stable guardrails upgraded to Rules
- specialist repeated review prompts upgraded to Subagents

**Prevents**

- prompt sprawl and duplicate operating truth

### 7. `06-credit-efficiency.mdc`

**Purpose**\
Protect the Cursor Pro budget.

**Mode**\
Always-on.

**Must enforce**

- Plan Mode before non-trivial tasks
- exact target files and thin slices
- shell scripts/hooks/CI for repeatable checks
- minimal rewrites
- minimal subagent use

**Prevents**

- wasteful whole-repo scans and over-broad prompts

---

## Final recommended Cursor skills

### `skill-installer`

Use for installing curated skills or importing from GitHub paths. Must support:

- listing curated installable skills
- installing curated skills
- installing from GitHub repo paths, including private repos already accessible to the user
- helper script usage where useful
- install target: `$CODEX_HOME/skills`
- reminder to restart Codex after install

### `repo-bootstrapper`

Use for creating the Phase 00 scaffold. Should inspect current repo state, compare to target structure, implement missing scaffolding, avoid product logic, and output created files plus open questions.

### `docs-maintainer`

Use when repo/process/structure changes require doc updates. Should identify canonical docs, update minimally, avoid duplicated truth, and sync status/changelog/roadmap where needed.

### `roadmap-status-sync`

Use when milestones, completion status, or next steps change. Should keep `ROADMAP.md` and `STATUS.md` aligned.

### `changelog-updater`

Use for meaningful repo changes. Should update the changelog without noise.

### `prompt-librarian`

Use to inventory prompt files, classify them, and recommend promotion to Skill/Rule/Subagent where appropriate.

### `security-review`

Use before or after security-sensitive changes. Should focus on BYOK, secrets handling, trust boundaries, logging, privacy, auth, and data minimisation.

### `architecture-recorder`

Use when an architecture or governance decision becomes real. Should record confirmed vs provisional decisions in the right canonical place.

### `release-prep`

Use before Phase 01 or before a meaningful release milestone. Should run a readiness audit against the required docs, scaffolding, scripts, and workflows.

---

## Final recommended Cursor subagents

Keep the set intentionally small.

### `repo-auditor`

Compares current repo structure against the agreed Phase 00 target and reports drift or missing files.

### `docs-maintainer`

Reviews docs consistency and warns about duplicate truth or missing updates.

### `security-reviewer`

Performs narrow review on sensitive files and flows, especially around BYOK, secrets, logging, auth, and storage.

### `test-designer`

Recommends the minimum high-value verification for a change.

### `prompt-librarian`

Classifies prompt assets and recommends governance actions.

### `release-readiness-checker`

Assesses whether Phase 00 or a release gate is truly complete.

---

## Security baseline for Restormel Keys

### Mandatory before product coding begins

- define trust boundaries
- define sensitive data classes
- ban raw-key logging everywhere
- ban committed secrets and sample live credentials
- define redaction rules for docs, logs, tests, and screenshots
- define secret-location expectations
- define baseline authn/authz expectations for future dashboard/API work
- define least-retention and data-minimisation expectations
- define vulnerability handling expectations
- define dependency hygiene expectations

### BYOK-specific risk areas

- API keys exposed via logs or analytics
- insecure examples copied by builders into production
- validation flows making unnecessary or over-trusting provider calls
- central proxy assumptions normalized too early
- cross-project or cross-user scoping mistakes

### Dangerous anti-patterns to ban early

- plaintext keys in localStorage examples presented as normal
- realistic secret strings in docs or screenshots
- “temporary” debug logging of secrets
- central proxy assumptions treated as default product behavior
- broad admin capabilities without project scoping

### Optional later hardening

- formal threat matrix expansion
- deeper SAST/DAST
- SBOM generation
- signed releases

---

## Reliability baseline for Restormel Keys

### Mandatory baseline

- safe failure over silent failure
- structured logging expectations
- health/readiness expectation for future hosted components
- rollback expectations for releases and destructive changes
- migration/change safety notes before irreversible actions
- degraded-mode expectations for dependency outages or validation failures
- incident-readiness stub in `docs/runbooks.md`
- release-readiness gate before more complex hosted flows

### Reliability principles

- clear failure is better than hidden partial success
- errors should preserve user trust
- destructive or state-changing behavior must be auditable
- future hosted components must prefer explicit readiness and rollback discipline

---

## Safe UX baseline for Restormel Keys

### Mandatory expectations

- loading, empty, success, and error states are required
- destructive actions require confirmation
- privacy-sensitive messaging is required around key flows
- errors should be clear without leaking sensitive details
- defaults must be non-dangerous and non-deceptive
- accessibility baseline must include labels, keyboard support, focus management, and meaningful status/error messaging
- degraded-mode behavior must remain user-trust-preserving
- support/debug visibility should use masked identifiers rather than raw secrets

---

## Testing and verification strategy

### Mandatory in Phase 00

- repo hygiene checks
- docs presence/review checks
- secret scanning
- dependency policy checks
- config and workspace file validation
- CI wiring for all of the above

### Mandatory once product coding begins in Phase 01

- lint
- typecheck
- unit tests for core behavior
- targeted integration tests for critical interfaces

### What can wait until later

- broad E2E suites
- browser matrix coverage
- bundle and performance budgets
- dashboard and billing journey tests
- advanced observability or release automation

---

## Hooks, scripts, CI, and automation

### Scripts

#### `scripts/review-docs.sh`

Checks required canonical docs exist and basic doc structure is coherent.

#### `scripts/docs-update-checklist.sh`

Prints a short checklist of docs that should be reviewed after repo/process changes.

#### `scripts/check-repo-hygiene.sh`

Checks expected folders/files exist and obvious bootstrap drift has not appeared.

#### `scripts/check-secrets.sh`

Searches for obvious secret patterns and tracked `.env` mistakes.

#### `scripts/check-dependency-policy.sh`

Checks package manifests and helps keep core dependency policy aligned.

### Workflows

#### `ci.yml`

Runs the main bootstrap checks on push and PR.

#### `docs.yml`

Runs doc checks when docs change.

#### `repo-hygiene.yml`

Runs periodic or on-demand hygiene checks.

### Templates

Use a PR template that requires:

- what changed
- why
- canonical docs updated
- security impact
- reliability impact
- checks run
- scope confirmation that bootstrap constraints were respected

---

## Canonical docs package

Each doc should have one clear purpose.

### Root docs

- `README.md` — public repo entry point
- `ROADMAP.md` — execution roadmap
- `STATUS.md` — current state and next actions
- `CHANGELOG.md` — meaningful changes
- `CONTRIBUTING.md` — how to work in repo
- `ARCHITECTURE.md` — architecture summary and decisions

### Docs package

- `docs/bootstrap-plan.md` — this Phase 00 plan
- `docs/bootstrap-checklist.md` — completion checklist
- `docs/working-agreement.md` — repo norms and operating model
- `docs/security-baseline.md` — canonical security baseline
- `docs/threat-model-starter.md` — trust boundaries and initial risks
- `docs/reliability-standards.md` — reliability baseline
- `docs/testing-strategy.md` — what is verified when
- `docs/release-readiness.md` — release and phase gate expectations
- `docs/prompts-reference.md` — prompt inventory
- `docs/prompt-governance.md` — prompt lifecycle rules
- `docs/skills.md` — skill inventory and usage guidance
- `docs/subagents.md` — subagent inventory and boundaries
- `docs/runbooks.md` — early operational notes
- `docs/decisions/README.md` — decisions log guidance
- `docs/archive/README.md` — archive rules

Do not duplicate the same operational truth across multiple docs.

---

## Prompt governance

All prompt files should be classified as:

- **Canonical** — current approved operational prompt
- **Reference** — useful but not authoritative source material
- **Archive** — superseded prompt retained for traceability

Prompt governance rules:

- every prompt must have purpose and status
- repeated workflow prompts should be promoted to Skills
- stable repo law should be promoted to Rules
- narrow specialist repeat-review prompts should become Subagents
- prompt packs should be inventoried and governed, not allowed to silently become repo law

---

## Credit-efficiency strategy for Cursor Pro

### Core operating principle

Spend credits on high-value planning, structured generation, and focused review. Do not spend them on things bash scripts or concise templates can do more cheaply.

### Minimum high-value operating set

- 7 rules
- 8 skills
- up to 6 subagents, used sparingly
- lightweight scripts and CI for repeated checks

### When to use Plan Mode

Always for non-trivial work. Especially for:

- multi-file changes
- repo structure changes
- security-sensitive changes
- workflow/CI changes
- rule/skill/subagent generation

### When not to use Subagents

- simple file creation
- obvious doc edits
- boilerplate script scaffolding
- routine changes with clear file targets

### What should be shell-scripted

- required file checks
- docs checks
- secret checks
- dependency policy checks
- hygiene checks

### What should be done manually

- approval of provisional decisions
- lifting the bootstrap gate
- deciding whether a new tool is worth the complexity
- verifying that generated docs actually express intent

### Before you code checklist

- Is this still Phase 00 work?
- What exact files need to change?
- Which canonical docs must be updated?
- Can a script/check do this cheaper than an agent?
- Is Plan Mode required?

### Before you spend credits on a big task

- Can this be split into smaller prompts?
- Do I really need a subagent?
- Am I editing or rewriting?
- Is there already a Skill, Rule, or canonical doc for this?
- What is the smallest acceptable result today?

---

## Final acceptance checklist for Phase 00

Phase 00 is complete when:

- root docs exist and are coherent
- the canonical `docs/` package exists
- `.cursor/rules/` contains the agreed rules set
- `skills/` contains the agreed skills set
- `subagents/` contains the agreed small specialist set
- `scripts/` contains the required cheap checks
- GitHub workflows and templates exist
- security baseline is documented
- threat model starter is documented
- reliability baseline is documented
- testing strategy is documented
- release readiness is documented
- prompt governance is documented
- prompt inventory is documented
- repo structure aligns with the agreed monorepo direction
- no meaningful product/business logic has been added
- a clear approval gate exists for Phase 01

---

## Recommended sequencing

1. Run the master bootstrap prompt in Cursor.
2. Review the created repo structure manually.
3. Generate or refine Rules.
4. Generate or refine Skills.
5. Generate or refine Subagents.
6. Generate scripts and workflows.
7. Generate or refine the canonical docs package.
8. Run a repo-auditor pass.
9. Run a release-readiness-checker pass.
10. Approve or reject lifting the bootstrap gate.

---

## Scope discipline note

Do not build provider logic yet. Do not build billing yet. Do not build hosted product behavior yet. Do make the repository structure, docs, guardrails, security posture, and cheap enforcement layer excellent immediately.

The wrong polish now is premature implementation. The right polish now is clarity, safety, maintainability, and low-cost repeatability.

