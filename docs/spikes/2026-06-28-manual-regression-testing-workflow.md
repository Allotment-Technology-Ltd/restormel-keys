---
title: "Spike — Manual regression testing workflow (feasibility)"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-28
last-reviewed: 2026-06-28
review-interval: P12M
---

# Spike — Manual regression testing workflow (feasibility)

**Date:** 2026-06-28 · **Type:** spike (explore + report, no build) · **Time-box:** one session.
**Bottom line:** **~90% of this already exists in your own code.** The capture layer, results
store, reporting UI shell, step-through UI, and a *working* Huly issue-creation client are all
present across Restormel + restormel-ops. The only genuinely missing piece is a thin **manual
pass/fail UI** and the **failure→Huly wiring** (~1 day with Claude Code). Net-new infra (Kiwi)
or commercial (Jam/Qase) is **not** justified.

---

## Track A — Codebase reconnaissance (the decisive track)

Scanned: **Restormel** (`restormel-keys`, Forgejo), **allotmentology** (`allotment-technology-ltd`,
GitHub, Next.js portal), **sophia** (`sophia` = usesophia, SvelteKit), plus **restormel-ops**
(Forgejo, ops repo) as a bonus. **plotbudget is not checked out locally** — see note at the end.

### 🟢 Restormel — a near-complete substrate

Restormel literally ships a **"Restormel / Testing" product** (a family of `packages/testing-*`,
merged in from a former standalone `restormel-testing` repo). Each maps onto a requirement:

| Requirement | Existing code | Repo / path | Reuse readiness |
|---|---|---|---|
| **Browser session capture (network/console/video/replay)** | `@restormel/testing-browser-playwright` — Playwright session methods `launch` / `navigate` / `act` / `observe` / `artefacts`, with `page.on` capture of **console + network + trace + screenshot** (`trace-bridge.ts`). Playwright *trace* = network + console + DOM snapshots + video. | `restormel-keys/packages/testing-browser-playwright` | **Drop-in** for automated capture. For *manual* testing it's optional (PostHog replay covers it). |
| **Test runner / step execution / artefacts** | `@restormel/testing-runner` — suite execution, retries, screenshot artefacts. `@restormel/testing-cli` (`testing` bin: init/validate/run/report). | `restormel-keys/packages/testing-runner`, `…/testing-cli` | Reusable, **but agentic** (browser goals judged by Keys LLMs) — see caveat. |
| **Results store + API** | `@restormel/testing-runs-server` — HTTP `GET/POST /v1/runs`, `NeonRunsStore` → table **`restormel_testing_run_jobs`** (migration `027`). | `restormel-keys/packages/testing-runs-server` | **Drop-in** results backend; reuse the table or add a sibling. |
| **Reporting UI / dashboard** | `/testing` + **`/testing/dashboard`** SvelteKit routes (the Testing product dashboard) + `@restormel/testing-report` (JSON artefacts + summaries). | `restormel-keys/apps/dashboard/src/routes/testing/*` | Reusable shell for a results view. |
| **Step-through / checklist UI pattern** | `PipelineWizardStepper`, `WalkthroughStep`, `StackSetupWizard`, `ConnectPipelineWizard`. | `…/lib/components/connect/pipeline/`, `…/dashboard/` | **The "one case at a time" UI is already a solved pattern** — re-skin a stepper. |
| **Webhook handling** | `…/api/webhooks`, `…/api/billing/webhook` (signature-verified), Connect `…/connect/v1/webhooks`. | `restormel-keys/apps/dashboard/src/routes` | Pattern reuse for an inbound failure-event receiver (not strictly needed). |

**⚠️ The one caveat that matters:** the testing framework is **automated/agentic** — it drives
Playwright with *browser goals* and grades them with **Keys-backed LLM judges**. There is **no
manual "show case → human marks pass/fail" mode** (grep for manual/checklist/pass-fail = nothing).
So you reuse its *plumbing* (capture, runs store, report, UI shell), not its *control flow*. That
plumbing is exactly the expensive 90%.

### 🟢 restormel-ops — the Huly bridge already exists

`restormel-ops/product-ops/forgejo-pack/huly/` is a full, **proven** Huly toolkit (it powers the
live WS3 automation and the ticket CLI):
- `import.mjs` → **`createIssue(client, projectId, projectIdentifier, mapped, uploadMarkdown)`**
- `apply-intent.mjs`, `set-huly-status.mjs`, `dump-active.mjs`, `validate-apply.mjs`
- Auth = `@hcengineering` SDK + **`HULY_SERVER_SECRET`** token mint (cluster-wired via `run.sh`).

→ **"Failures create Huly issues" is not a build — it's calling an existing `createIssue()`.**
The only work is exposing it to the runner (an API route, or a tiny MCP/CLI shell).

### 🟡 sophia (usesophia)
SvelteKit app that **consumes** the testing approach: `playwright.config.ts` + `tests/e2e/*`
(learn-flow, app, mobile-shell, a11y-smoke, graph-explorer). **No novel infra** — it's a *reference
consumer* and a good proving ground, not a source of reusable parts.

### 🔴 allotmentology
Next.js portal (Better Auth). Only `.next` build artefacts matched the search terms — **nothing
uniquely reusable**, and it's a different framework (Next, not SvelteKit).

### ⚪ plotbudget — NOT scanned (not checked out locally)
From memory it's Next.js + self-hosted Supabase (api.plotbudget.com) on Vercel — a **different
stack**, low expected reuse value for a SvelteKit/Playwright workflow. Can clone + scan on request;
not expected to change the answer.

**Track A verdict — direct answer to the spike question:**
> **Yes**, a bespoke lightweight runner can be assembled *primarily* from existing code.
> **Delta = (a)** a manual pass/fail UI (trivial — steppers exist), **(b)** failure→Huly wiring
> (the only real work — auth + an API route around `createIssue()`), **(c)** a results row
> (reuse `restormel_testing_run_jobs` or add a sibling table). **≈ 1 day**, not a from-scratch build.

---

## Track B — Claude-native options (given Max x20)

> These are external Anthropic products — assessed from capability, not grepped. Each verdict has a
> "verify with a 30-min trial" caveat.

**Claude in Chrome (beta) — as the capture layer**
- ✅ Can: navigate to a URL, perform a test step, **screenshot**, and produce a structured narrative
  of *visible* state (rendered DOM, on-page error banners, console errors *that surface in the page*).
- ❌ Cannot: read DevTools internals programmatically — no full network waterfall, no HAR, no video
  trace. (You already flagged this; confirmed.)
- **Realistic use:** "drive the steps + screenshot + narrate, human marks pass/fail" — **good enough
  for triage**, but the capture is *shallower* than PostHog replay or a Playwright trace. It does not
  replace PostHog for the "what actually happened on the wire" question.
- **Effect:** reduces the *driving* build to ~zero; does **not** give rigorous capture.

**Cowork — as the orchestrator**
- ✅ Plausible: read the test script, present cases one at a time (in chat), accept pass/fail (chat),
  on fail call the restormel-ops **`createIssue`** (via the existing Forgejo/ops relay or a small MCP
  tool), and record a PostHog URL the tester pastes.
- ⚠️ Friction: it's **conversational, not a checklist UI** — no per-case buttons, no progress bar; a
  40-case regression pass becomes 40+ chat turns, and state lives in the thread. Fine for a short
  smoke pass, awkward as the *standing* regression workflow.
- **Effect:** can eliminate the build entirely **if** you accept chat-UX and add one Huly tool.

**Dispatch — NOT applicable**
- `@restormel/dispatch` (renamed from `@restormel/aaif`) is an **in-process AI request/response
  Interaction Format** over Keys routing/cost — explicitly **"not a wire protocol," not a queue/bus.**
  It is the wrong primitive for a failure→Huly bridge. Dead end; note and move on.

**`@restormel/mcp` (~50 tools) — limited relevance**
- The surface is **product-domain only**: `connect.*`, `routes.*`, `policies.*`, `models.*`,
  `cost.*`, `entitlements.*`, `docs.*`, `readiness.check`. **No webhook, generic-HTTP, or
  issue-creation tool.** So MCP **cannot** bridge PostHog→Huly today.
- **But** the cheapest high-leverage move in the whole spike: **add one MCP tool** (`testing.file_issue`
  or similar) that wraps restormel-ops `createIssue()`. Then *both* Cowork and Claude-in-Chrome can
  file Huly issues natively — turning Track B from "awkward" into "viable" for near-zero code.

**Track B verdict:** Claude-native **reduces** the build but doesn't cleanly **eliminate** it unless
you accept chat-UX (Cowork) and add a tiny Huly MCP tool. Capture still wants PostHog, not Chrome.

---

## Track C — Bespoke lightweight build (cost, given the reuse)

A SvelteKit page **inside the existing Restormel dashboard** (it already has `/testing/*` and auth):
- Load a script (`.md`/`.json` in-repo) → show one case at a time via a re-skinned **`PipelineWizardStepper`**.
- **Pass / Fail / Skip** buttons; on **Fail** → POST to a new API route that calls restormel-ops
  **`createIssue()`** with case name + steps + a **PostHog session URL** field (tester pastes it).
- Persist results to **`restormel_testing_run_jobs`** (reuse) or a sibling table; summary via
  `@restormel/testing-report`.

**Estimate: ~1 day with Claude Code** (not 2 hours — but not more than a day either). The UI is a
half-hour given the steppers; the day goes to:
- **Hardest part:** the failure→Huly wiring **with auth**. `HULY_SERVER_SECRET` is cluster-side; the
  dashboard either gets scoped access to it or routes the call through the **ops relay** / a small
  job. This is the one genuinely fiddly bit (and is shared with Track B).
- Deciding the results schema (reuse 027 vs. a clean `manual_test_runs` table).

**Recording gap — recommendation:**
1. **PostHog session replay (manual link paste)** ✅ **recommended** — already live, **zero build**,
   gives network + console + **video replay** that Claude-in-Chrome can't. The tester copies the
   replay URL into the fail form.
2. Browser extension — **multi-day build + maintenance; skip.**
3. Accept PostHog owns capture, app owns workflow — **this is option 1, stated as a principle.** Yes.
   *(Optional upgrade for high-value flows: auto-attach a **Playwright trace** via
   `testing-browser-playwright` — but that's the automated path; for manual, link-paste PostHog wins.)*

---

## Track D — OSS baseline (PostHog + Kiwi TCMS + Huly webhook)

- **PostHog session replay** — *already running, zero config*: network + console + video replay
  **today**. The capture half of the problem is effectively **already solved** by your live stack.
- **Kiwi TCMS on Coolify** — Dockerized (official image + **MariaDB/MySQL**). ⚠️ **Neon Postgres is
  not a clean fit** — Kiwi officially targets MariaDB; Postgres is community/partial. It's a heavy
  Django case-management app (more than "lightweight"). Setup ≈ half-day **+ a MariaDB you don't
  otherwise run** + ongoing patching. Gives polished multi-tester case management + history.
- **Huly bridge** — Kiwi has a JSON-RPC API + signals; wiring fail→Huly = a small receiver calling
  `createIssue()`. Same wiring as the bespoke option, **plus** a whole extra app to host.

**Verdict:** PostHog stays (it's your capture engine regardless). Kiwi adds real case-management but
**violates "lightweight"** and adds a MariaDB + Django app to maintain — only worth it if you need
multi-tester case libraries with history/assignments.

---

## Track E — Commercial baseline (one paragraph)

**Jam.dev + Qase free tier:** Jam gives the **best capture UX, full stop** — one-click bug capture
with auto-attached console + network + video + repro steps (better DevTools capture than anything
self-hosted or Claude-in-Chrome). Qase free = test-case management + run tracking. The catches:
(1) **not self-hosted** — data leaves the UK/EU, which contradicts the sovereignty principle the
whole stack is built on; (2) **Huly is not a native integration** for either (they target Jira/Linear/
GitHub) → **you still build a Qase-webhook→Huly bridge**; (3) free tiers cap members/retention, real
team use is ~£10–20/user/mo. **Honest verdict:** lowest build + best capture, but breaks self-hosting
and *still* needs the Huly bridge — so it doesn't even remove the one piece you'd most want removed.

---

## Recommendation table

| Option | Setup cost | Ongoing friction | Recording quality | Huly integration | Verdict |
|---|---|---|---|---|---|
| **Claude-native** (Cowork + Claude-in-Chrome) | ~½ day (add 1 Huly MCP tool) | High — chat-UX, no checklist, thread-bound state | Medium (Chrome screenshots/narrative) **or** PostHog link | Via new MCP tool wrapping `createIssue()` | **Good for ad-hoc/smoke**, awkward as standing workflow |
| **Bespoke SvelteKit** (reuse testing-* + ops Huly + PostHog) | **~1 day** | **Low** — purpose-built UI in your dashboard | **High** (PostHog replay link) | **Reuses `createIssue()`** (auth-wiring is the work) | ✅ **Recommended** — self-hosted, ~90% existing code |
| **OSS** (PostHog + Kiwi TCMS + webhook) | ~1–1.5 days + a MariaDB | Medium — extra app to host/patch | High (PostHog) | Custom webhook → `createIssue()` | Overkill unless you need multi-tester case libraries |
| **Commercial** (Jam + Qase) | ~2–3 hrs | Low tool-side, but **off-stack** | **Highest** (Jam) | **Still custom** (no native Huly) | ❌ Breaks self-hosting; still needs a bridge |

---

## Recommended path

**Build the bespoke-light SvelteKit runner inside the Restormel dashboard, reusing the `testing-*`
plumbing + restormel-ops `createIssue()` + PostHog replay for capture. ~1 day.**

Sequence it so value lands immediately and the build is *optional*:
1. **Day-0, zero build:** run regression from a **markdown script** + **PostHog replay** for capture
   + the existing **huly-ticket-cli** (or a 1-tool MCP) to file failures. Prove the workflow manually.
2. **If/when the markdown+CLI flow is too clunky:** spend the ~1 day on the SvelteKit runner (stepper
   UI + Pass/Fail/Skip + fail→`createIssue` API route + reuse `restormel_testing_run_jobs`).
3. The **single highest-leverage atom**, useful to *both* paths: a small **`testing.file_issue` MCP
   tool** wrapping `createIssue()` — it unblocks Cowork/Chrome *and* the bespoke app.

## What would change this recommendation

- **If capture must be programmatic/automatic** (not manual link-paste) → don't build manual; instead
  extend the **existing agentic `testing-runner`** (Playwright trace auto-capture) — you're then 80%
  toward automated E2E, a different and arguably better project.
- **If you need a real multi-tester case-management library** (history, assignments, suites over time)
  → the 1-day bespoke build is deliberately too minimal; pick **Qase** (commercial, accept off-stack)
  or **Kiwi** (OSS, accept the MariaDB + weight). The bespoke runner is the right call *only* while
  "one tester, lightweight, self-hosted" holds.

## Open follow-ups
- Confirm **PostHog `session_recording`** is actually enabled (you said it's available; `posthog.init`
  is present — worth a 1-min check that replays exist for the dashboard host).
- Decide where `HULY_SERVER_SECRET` is exposed to the runner (scoped dashboard env vs. ops relay) —
  this is the one real design decision and it's shared by every option that files Huly issues.
- (Optional) clone + scan **plotbudget** if you want the 4th repo formally cleared; low expected value.
