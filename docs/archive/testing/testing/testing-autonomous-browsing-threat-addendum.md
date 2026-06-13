# Addendum — autonomous browser / agent loop (Restormel Testing)

**Extends:** [threat-model-starter.md](../threat-model-starter.md), [security-baseline.md](../security-baseline.md)  
**Scope:** LLM-driven browser automation (`execution_mode: ac_sequence`, built-in agent loop, optional `judge_rubric`).

## Trust boundaries

- **Config repo** defines goals, allowlisted origins (implicit: environment `base_url` same-origin for navigation), and **logical** Keys refs — not raw secrets.
- **Runner process** holds resolved credentials **in memory** for provider calls; must not write them to `run.json`, traces, or step logs.
- **Target application** is untrusted input to the agent: malicious pages could try to exfiltrate via model prompts (mitigate with **same-origin** navigation rules and **no secret echo** in observation payloads where possible).

## Threats specific to agentic browsing

| Threat | Mitigation (product) |
|--------|----------------------|
| **Secret exfiltration via page content** | Strip or cap page text in model context; never inject resolved API keys into page-facing prompts; redact patterns in reporting layer |
| **SSRF / lateral navigation** | AC agent: same-origin checks on `navigate`; reject off-origin URLs |
| **Runaway cost** | `maxRoundsPerCriterion`, job timeouts, optional future token budgets |
| **Malicious YAML in fork PRs** | Default `fork_pr_policy: skip`; optional `require_label` / `sandbox_only` — [github-action-io-spec.md](github-action-io-spec.md) |
| **Prompt injection from DOM** | Treat DOM as untrusted; system prompt instructs task-only behaviour; rubric judges bounded JSON |

## Logging and artefacts

- Log **logical ref** and **run id** — not key material ([security-baseline.md](../security-baseline.md)).
- Screenshots may contain PII: `artifact_policy.screenshots` defaults to **on_failure**; document retention for CI uploads.

## Egress

The built-in **`ac_sequence`** agent allows navigation to the environment **`base_url` origin** by default. Optional per-environment **`egress_allow_hosts`** lists **additional hostnames** (or `https://…` URLs whose hostname is extracted) the agent may `navigate` to — e.g. a separate API host. Entries are **not** secrets; keep the list minimal. Default-deny remains for any host not listed and not same-origin.

**Network egress (all browser goals):** Playwright **`BrowserContext` route blocking** enforces the **same** allowlist for **every** page-originated request — document navigations, scripts, `fetch`, XHR, fonts, **`WebSocket`**, etc. — not only the agent’s **`navigate`** tool. Inline **`data:`**, **`blob:`**, and **`about:`** URLs are still allowed so typical in-document resources work. Custom **`createBrowserSession`** hooks must apply equivalent policy if they substitute the default Chromium session (or expose a real **`page.context()`** so the runner can attach routes).
