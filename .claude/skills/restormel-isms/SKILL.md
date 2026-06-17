---
name: restormel-isms
description: >-
  The Restormel / Allotment Technology Ltd information-security & governance (ISMS) operating
  conventions. Use this in ANY Restormel or allotmentology.tech session (chat, Cowork, or Claude
  Code) WHENEVER work touches governance, policy, records, evidence, compliance, audit, ISO 27001
  or ISO 42001, Cyber Essentials, GDPR / ROPA / DPIA, data residency or sovereignty, risk, asset
  or sub-processor / connector inventory, access reviews, incidents, or anything record-worthy —
  even if not named directly (e.g. "we added a new vendor", "log this incident", "is this
  compliant", "update the policy", "who can access X"). It explains the repo-anchored ISMS so
  records stay canonical in restormel-keys, the register stays in sync, and nothing invents
  governance. Pair with restormel-product-ops when the work also needs a backlog item.
---

# Restormel ISMS — repo-anchored governance

The ISMS is **repo-anchored**: the canonical system of record is **`restormel-keys`** on Forgejo
(`git.allotmentology.tech`), with a front-matter convention, a generated register, and CI
enforcement. **Forgejo is the single governance plane; GitHub is a push-only mirror — never plan
around it.** This skill is the operating convention; the canonical definitions live in the repo —
defer to them, don't restate or invent them:

- `records/SCHEMA.md` (`REC-GOV-001`) — the metadata convention, control tiers, register rules.
- ADR `docs/decisions/records-architecture.md` (`REC-ADR-001`) — why it's built this way.
- `governance/` (policies) and `evidence/` (proof) — greenfield from Phase 4 of the IA plan.
- `OPERATING-MANUAL.md` and `playbooks/` in the cockpit (restormel-ops).

## Core distinctions (respect these)

- **Documents vs Records.** A *document* is current guidance (a policy); a *record* is dated proof
  that something happened (an access review, an incident). They live and are tiered differently —
  see `records/SCHEMA.md`.
- **Four control tiers.** Records carry a tier that drives CI strictness and review. Use the tier
  the SCHEMA/ADR defines for the artefact; don't guess — if unsure, say so and check `records/SCHEMA.md`.
- **Certification framing** (from strategy): Cyber Essentials and ISO 27001 are *gates* buyers
  require; ISO 42001 is a *differentiator*. GDPR/ROPA + a trust centre support the sovereignty story.
  Distinguish gates from differentiators; mark certification status `[PLACEHOLDER — founder/counsel]`
  until real.

## The two standing rules

1. **Never invent governance or legal content.** Scaffold the structure and insert
   `[PLACEHOLDER — founder/counsel]` for anything needing real specifics or legal review, and flag
   it. An honest skeleton beats a confident-looking policy full of invented detail.
2. **Self-maintaining records.** When an action introduces or changes a *managed fact* — an asset,
   a sub-processor/connector, a data flow, a capability, or a decision — stage the matching
   **register/record update in the same change** (don't wait to be asked). Route it through the
   normal change control (bundle → relay → PR → CI + merge); **never silently edit an approved doc**.

## Sovereignty guardrails

- **Cowork and the Claude chat project are US-SaaS** and are **not** the audit trail: they hold
  **no regulated/customer data**. Keep sensitive data in the sovereign repo; draft *in front of* it.
- Log US-SaaS tools (Vercel/Sentry/Google/Notion, Cowork itself) as **sub-processors**; keep the
  verification path and credentials off third-party US SaaS without flagging the trade-off.
- The canonical, attributable history is the repo + CI — not a chat or a Cowork session.

## The playbooks (recurring human work → records)

Run from the cockpit (`playbooks/`); outputs land in `restormel-keys` at the right tier via a bundle.

| Playbook | Cadence | Output (repo path, tier) |
|---|---|---|
| `quarterly-access-review.md` | quarterly | `evidence/access-reviews/` — Tier 3 |
| `policy-review.md` | per review-interval / when flagged | `governance/<policy>.md` — Tier 2 |
| `incident-capture.md` | ad hoc | `evidence/` record or `evidence/ledger.jsonl` — Tier 3 |
| `annual-management-review.md` | annual | `evidence/management-reviews/` — Tier 2/3 |
| `governance-drafting.md` | as needed | `governance/…` — Tier 2 |

The canonical *reminder* that a playbook is due is the **Forgejo cron evidence agent (Phase 6)** —
not Cowork `/schedule` (use that only for convenience nudges).

## Act by surface

- **Claude chat (no tools):** produce the draft/record skeleton in the right tier's shape with
  `[PLACEHOLDER — …]` where needed; end with a handoff ("Hand to Cowork" / "Hand to Claude Code").
- **Cowork (sandbox):** draft, then stage a **bundle** to `restormel-keys` via the relay
  (`cowork-relay/BUNDLE-FORMAT.md`); if the change is a managed fact, include the register update in
  the same bundle. Don't commit to the mirror; don't hold regulated data here.
- **Claude Code (Mac):** write under `records/`/`governance/`/`evidence/` per `records/SCHEMA.md`,
  regenerate the register, and let CI enforce. Open a PR to `main` (Forgejo origin).

## If in doubt

Read `records/SCHEMA.md` and `REC-ADR-001` before asserting tier, front-matter, or register
mechanics — they are canonical and may have advanced past this skill. When governance specifics are
unclear, scaffold + `[PLACEHOLDER — founder/counsel]` and flag, rather than inventing.
