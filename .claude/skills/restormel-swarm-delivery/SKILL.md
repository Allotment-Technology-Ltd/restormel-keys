---
name: restormel-swarm-delivery
description: >-
  How to deliver larger Restormel work as a parallel multi-agent swarm: when to swarm, partitioning work
  to maximise parallelism (disjoint files / worktree isolation), tiered model + reasoning-effort selection
  per agent, the self-improving skill-gap-closing rule (agents author new skills when capability gaps
  appear), a dedicated CI-management agent, and per-PR review + high-risk-security discipline. Use when
  orchestrating a swarm/workflow, fanning out agents, or planning multi-stream delivery.
---

# Restormel swarm delivery (multi-agent orchestration)

Encodes how we run parallel agent swarms so they go fast AND stay governed. Reflects the operator's
standing preference to fan out multi-discipline agents for big builds.

## When to swarm
Larger roadmap/build work with separable streams (multiple emails, pages, migrations, audits). Small or
tightly-coupled changes stay single-agent. The operator opts in ("swarm", "in parallel"); don't swarm
unprompted for routine work.

## Maximise parallelism (avoid conflicts)
- **Partition by file ownership.** Give each agent a DISJOINT set of files (e.g. one new template per
  agent). Parallel writes to different files are safe; parallel edits to a SHARED file (e.g. `send-mail.ts`,
  a route, a migration) are not — assign shared-file edits to ONE agent, or serialise them.
- **Worktree isolation** (`isolation:"worktree"`) only when agents must mutate overlapping files in
  parallel — it costs setup + a merge step. Prefer disjoint files first.
- Wiring/integration that touches shared files is a **serial finishing stage**, not parallel.

## Tiered models + reasoning effort (pick per task)
| Work | Model | Effort |
|------|-------|--------|
| Copy, microcopy, usability, design/UX quality, naming | **Fable** | medium–high |
| Hard architecture, security review, adversarial verification, tricky bugs | **Opus** | high–max |
| Standard engineering (templates, routes, tests, migrations) | **Sonnet** | medium |
| Mechanical/bulk (renames, formatting, scaffolding) | **Haiku** | low |
Default to omitting the model (inherit session) only when unsure; otherwise choose deliberately. Match
effort to difficulty — don't burn `max` on mechanical work or `low` on a security verify.

## Self-improving: close capability gaps with skills
**When an agent hits a capability gap — a recurring task with no skill, a non-obvious gotcha, a
convention it had to rediscover — it authors a new `restormel-*` skill** (`.claude/skills/<name>/SKILL.md`,
frontmatter `name` + `description`) to close the gap, and cross-links it. The skill library is expected to
grow as a by-product of delivery. Don't duplicate an existing skill — extend it.

## CI-management agent (always include one)
Every swarm has a dedicated **CI manager** that owns the pipeline: watches Forgejo CI on each branch/PR,
diagnoses + fixes red builds, applies the dependency self-heal loop, and reports merge-readiness. Back it
with [[restormel-ci-self-heal]]. It does NOT merge risky changes on its own (see review discipline).

## Review + safety discipline (non-negotiable)
- **Forgejo is primary** — push/PR/merge via `origin` (git.allotmentology.tech). GitHub is a mirror.
- **One PR per slice**; **never merge before the per-PR review verdict lands** (inline spot-checks miss
  what full review catches).
- **High-risk-security review before any PR** touching keys/auth/secrets/Connect/SvelteKit server
  routes/Postgres ([[restormel-high-risk-security]]).
- **Records keep themselves current** — stage governance updates in the same PR ([[restormel-isms-records]]).
- **Publish-when-live** ([[restormel-publish-when-live]]) — agents build ahead but never publish unshipped.
- The local `main` checkout auto-resets to `origin/main` — agents work in worktrees, never the live main.

## Roster (compose as needed)
Engineering (Sonnet), design/UX + copy (Fable, via [[restormel-email-design]]/[[restormel-email-copywriting]]),
security review (Opus, [[restormel-high-risk-security]]), CI manager ([[restormel-ci-self-heal]]),
governance (Opus/Sonnet, [[restormel-isms-records]]). Add domain agents (e.g. [[restormel-email-engineering]])
per the work.
