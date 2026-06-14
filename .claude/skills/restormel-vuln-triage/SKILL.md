---
name: restormel-vuln-triage
description: >-
  Vulnerability triage for Restormel Keys: walk the triage funnel, apply the severity SLA table
  (Critical 72h/24h-KEV, High 7d, Medium 30d, Low 90d), decide auto-fix vs scheduled-fix vs
  risk-accept vs false-positive, write suppression entries with mandatory expiry, and open or update
  tracking issues. Use whenever a scanner finding, Renovate PR, or externally reported CVE needs a
  triage decision — including when Agent D is merging a security PR, when a CI gate blocks on a
  new finding, or when a suppression is expiring and needs renewal or escalation.
---

# Vulnerability triage (Restormel Keys)

Canonical policy: [docs/security/vulnerability-management.md](../../../docs/security/vulnerability-management.md)
CI gate logic: `scripts/security/severity-gate.mjs` (authored by Agent A)
Renovate policy: `renovate.json` (authored by Agent A)

**Do not auto-merge anything.** The auto-merge decision belongs to Agent D based on CI status and the policy in `renovate.json`. This skill owns the *triage decision* — what to do with a finding — not the merge action itself.

---

## When to use this skill

Invoke when you have one or more of these in front of you:

- A `security` CI job failure on a PR (OSV-Scanner, pnpm audit, Trivy, gitleaks output)
- A Renovate PR with a security label
- An externally reported vulnerability (via `adam.boon1984+security@googlemail.com`)
- A suppression or risk-accept that is approaching or past its expiry date
- A Phase 2 weekly drift scan result (Forgejo issue or PostHog event)

---

## Triage funnel

Work through these steps in order for every finding. Do not skip steps.

### 1. Dedupe

Before triaging, check:
- Is there already an open Forgejo issue with labels `vuln/critical`, `vuln/high`, `vuln/medium`, or `vuln/low` for this CVE ID or package?
- Is there an active suppression in the codebase (`.osv-scanner-ignore`, `trivy.yaml`, or a `# trivy:ignore` comment) for this finding?
- Is there a Renovate PR already open for this package?

If any match: add context to the existing issue or PR rather than opening a duplicate. Update the SLA clock if needed.

### 2. Classify severity

Use CVSS v3 base score or the scanner's reported severity. If the scanner disagrees with CVSS, use the higher of the two for initial classification. Adjust for context:

- **KEV-listed or actively exploited**: treat as Critical regardless of score; apply the 24-hour SLA.
- **Reachability**: if the vulnerable code path is demonstrably not exercised by this application, note it in the issue and apply the next-lower severity class for the SLA. Do not suppress silently — document the reachability check.

### 3. Apply the SLA

| Severity | SLA | CI gate |
|----------|-----|---------|
| Critical (CVSS ≥ 9.0, or KEV) | 72 h (24 h if KEV) | Blocks build on fixable |
| High (7.0–8.9) | 7 days | Blocks build on fixable |
| Medium (4.0–6.9) | 30 days | Warn + auto-open issue |
| Low (0.1–3.9) | 90 days | Informational |

"Fixable" means a remediation version is available without a breaking change. If no fix exists, go to the risk-accept path.

SLA clock starts at the time the finding was first detected (scanner run timestamp or external report received date).

### 4. Make the decision

**Auto-fix:** a fix version exists, Renovate has opened or will open a PR, and the change is within the auto-merge policy in `renovate.json`. Confirm CI is green → hand off to Agent D to merge. No issue needed.

**Scheduled-fix:** a fix version exists but is not auto-mergeable (major bump, runtime-critical package, breaking change). Open a Forgejo issue with:
- Title: `[vuln/<severity>] CVE-YYYY-NNNNN — <package>@<version>`
- Labels: `vuln/<severity>`, `due:YYYY-MM-DD` (SLA deadline)
- Body: CVE description, affected path, fix version, SLA deadline, whether the path is reachable

**Risk-accept:** no fix version available, or the fix would require a breaking change that cannot land within the SLA. Requires:
1. Written justification in the Forgejo issue body (why it is not being fixed now)
2. Mandatory expiry date (see suppression policy)
3. Owner sign-off for Critical (Orchestrator surfaces to Adam); Agent D can sign off on High risk-accepts within the rolling 30-day window.
4. A suppression entry in the appropriate config file — see suppression policy below.

**False-positive:** the finding does not apply to this project (wrong OS, wrong runtime, wrong code path). Suppress with rationale and expiry — see suppression policy.

### 5. Record the outcome

In all cases except auto-fix, write a brief decision comment on the Forgejo issue or Renovate PR:

```
Triage: [auto-fix | scheduled-fix | risk-accept | false-positive]
Severity: [Critical | High | Medium | Low]
SLA deadline: YYYY-MM-DD
Reachability: [confirmed reachable | not reachable — <evidence> | not checked]
Decision: <one sentence rationale>
Expiry (if suppressed): YYYY-MM-DD
Reviewer: <agent ID or human>
```

---

## Suppression policy

Every suppression must have:
1. Written justification (why not fixed now)
2. Mandatory expiry date — no suppression is permanent:
   - Critical: max 14 days (owner sign-off to renew)
   - High: max 30 days
   - Medium: max 90 days
   - Low: next routine cycle (max 180 days)
3. Reviewer name (agent ID or human)
4. A tracking Forgejo issue

Suppressions without all four fields are treated as unresolved findings. If you are adding a suppression entry to `.osv-scanner-ignore` or a Trivy ignore comment, include the expiry date and CVE ID in the comment.

Example `.osv-scanner-ignore` entry:
```
# RISK-ACCEPT: CVE-2024-XXXXX — <package> not reachable via this app's runtime path.
# Expires: 2026-09-01. Reviewer: agent-D. Issue: forgejo#NNN
GHSA-XXXX-XXXX-XXXX
```

Suppressions approaching expiry (< 24 h remaining) trigger an escalation to the owner. Do not silently extend suppressions — create a new triage decision and document it.

---

## Escalation rules

| Trigger | Action |
|---------|--------|
| Critical — no fix available | Immediate owner notify; risk-accept required within 24 h |
| High SLA < 48 h remaining | Agent D escalates to Orchestrator → owner |
| Any SLA breached | Owner paged; `overdue` label added to issue; blocks next PR |
| Suppression expiring < 24 h | Reminder issued; renewal or fix required before expiry |
| KEV-listed finding | Immediate escalation regardless of current SLA status |

---

## Related

- `restormel-ci-self-heal` skill — how the Renovate auto-merge loop works and how to extend it
- `restormel-high-risk-security` skill — pre-PR security review (separate from post-detection triage)
- [docs/security/vulnerability-management.md](../../../docs/security/vulnerability-management.md) — full governance doc
- [SECURITY.md](../../../SECURITY.md) — external reporting and SLA summary
