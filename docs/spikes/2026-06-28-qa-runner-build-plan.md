---
title: "QA runner (manual regression) — build plan (launchpad tile)"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-28
last-reviewed: 2026-06-28
review-interval: P12M
---

# QA runner (manual regression) — build plan

**Placement (decided):** a **Launchpad tile** in the allotmentology company portal
(K3s `allotmentology-prod`, Next.js 16). Decoupled from Restormel (the system under test);
shares fate only with the portal. See `2026-06-28-qa-runner-launchpad-placement.md` for the
placement analysis and `2026-06-28-manual-regression-testing-workflow.md` for the option spike.

**Goal (definition of done):** a tester opens the **QA** tile, steps through a test script
**one case at a time**, marks **Pass / Fail / Skip**; a **Fail** files a **Huly RES issue**
(case + steps + a pasted **PostHog** session-replay link); results **persist + summarise**.

**Total estimate: ~1.5 days.** Hardest/riskiest: Huly in-cluster reachability (NetworkPolicy
allow-list — silent-drop gotcha). UI is **lift-and-adapt**, not from-scratch (see T2).

---

## Reuse ledger (free vs new)

| Free (reused) | Source |
|---|---|
| Auth / session, deploy / cert / ingress | portal `allotmentology-prod` Argo app + Better Auth (`(app)/` group already gated) |
| Results DB | portal **Drizzle + Neon** (already wired) |
| Run/verdict contracts + summaries | `@restormel/testing-core`, `@restormel/testing-report` (**public npm** — portal already pulls `@restormel/keys`) |
| Huly issue creation | restormel-ops `…/huly/import.mjs::createIssue()` (`@hcengineering` + `HULY_SERVER_SECRET`) — port into a small service |
| **On-brand React UI kit** | `design_handoff_restormel_onboarding/designs/proto-app.jsx` + `styles.css` — a **React** prototype of the dashboard with `GateRow` (pass/fail/todo status row), `Ledger` (checklist), `Screen`/`Sidebar` layout, on the standalone neo-brutalist stylesheet (no Tailwind/build deps) |
| Capture | **PostHog EU** (live; portal already bundles it) — link-paste |

| New (build) | Why |
|---|---|
| The runner UI components | Adapt `GateRow`/`Ledger` from the prototype into real React (the proto is a single-file mock, not a library) |
| `qa_runs` / `qa_results` tables | Drizzle migration in the portal DB |
| Huly **file-issue service** (Path B) | keeps `HULY_SERVER_SECRET` cluster-side |
| Huly **NetworkPolicy** allow + ESO secret | let `allotmentology-prod` reach the service |

---

## Tracked steps (each = one trackable sub-task)

> Lanes: **UI** (T1–T4, portal repo) and **Huly** (T5–T6, gitops + a small service) run in
> parallel; **T7** joins them; **T8** ships.

### T1 — Scaffold tile + route  ·  ~1h  ·  *(repo: allotmentology)*
- Add a `LaunchTile` (`id: qa`, section "QA", `TileAccess: shared-session`) to `src/lib/company/launchpad.ts`.
- Create route group `src/app/(app)/qa/` (gated by the portal session like the other `(app)/` routes).
- **AC:** tile renders on the launchpad; `/qa` returns 200 when signed in, redirects when not.

### T2 — On-brand UI kit  ·  ~2–3h  ·  *(repo: allotmentology)*  ·  dep: T1
- Drop `styles.css` (from the proto bundle) into the portal (scoped to `/qa` to avoid clobbering portal styles).
- Adapt `GateRow` → `<TestCaseRow status=pass|fail|skip|todo>` and `Ledger` → `<RunProgress>` from `proto-app.jsx`.
- **AC:** a static `/qa` screen renders on-brand (neo-brutalist) with a sample case row + progress.

### T3 — Runner workflow  ·  ~3h  ·  *(repo: allotmentology)*  ·  dep: T2
- Load a test script (markdown or JSON in the portal repo, e.g. `qa-scripts/*.md`); parse cases + steps.
- Show **one case at a time**; **Pass / Fail / Skip**; next/prev; progress; keyboard shortcuts.
- On **Fail** → a form with case name + steps prefilled and a **PostHog session URL** field.
- **AC:** can step a whole script start→finish and hold verdicts in component state.

### T4 — Results persistence + summary  ·  ~2–3h  ·  *(repo: allotmentology)*  ·  dep: T3
- Drizzle migration: `qa_runs` (id, script, started_at, by, summary) + `qa_results` (run_id, case, verdict, posthog_url, huly_ref, notes).
- Persist verdicts; render a run summary using `@restormel/testing-report`.
- **AC:** a completed run persists and shows a pass/fail/skip summary; reopenable from history.

### T5 — Huly file-issue service  ·  ~3h  ·  *(repo: restormel-ops + gitops)*
- Small service (huly ns, or restormel-ops on-cluster) exposing authenticated `POST /file-issue`
  `{project, title, body, labels}` → wraps the ops `createIssue()`. `HULY_SERVER_SECRET` via ESO, **stays in-cluster**.
- **AC:** an in-cluster `curl` with the service token files a real RES issue; bad/no token → 401.

### T6 — NetworkPolicy + secret wiring  ·  ~1–2h  ·  *(repo: gitops)*  ·  dep: T5
- Edit `applications/huly/50-networkpolicy.yaml` to allow `allotmentology-prod → file-issue-svc` **only**.
- ESO: a service-call token for the portal's API route (portal `10-externalsecret.yaml`).
- **AC:** a pod in `allotmentology-prod` reaches the service. ⚠️ **Gotcha:** huly ns is default-deny and
  **silently drops** unlisted callers (no error, just a hang/no-backend) — this bit WS3. Verify with an actual call.

### T7 — Portal API route → service  ·  ~1–2h  ·  *(repo: allotmentology)*  ·  dep: T4, T6
- `src/app/api/qa/file-issue/route.ts` (Node runtime): on Fail, POST to the file-issue service;
  build the issue body from case + steps + PostHog URL; store the returned `RES-NN` on `qa_results`.
- **AC:** clicking **Fail** in the UI creates a Huly issue and the row shows its `RES-NN` link.

### T8 — Deploy + smoke  ·  ~1–2h  ·  *(repos: all)*  ·  dep: T7
- Merge via Forgejo; Argo sync the portal + the service + the NetworkPolicy.
- Run a real 5-case script end-to-end; one deliberate Fail files a real Huly issue with the replay link.
- **AC:** green smoke; issue appears in Huly; results persisted.

### T9 — Seed first script (optional)  ·  variable
- Convert the integration-env test plan suites (A–J) into the runner's script format as the first real corpus.

---

## Dependency graph
```
T1 → T2 → T3 → T4 ┐
                  ├→ T7 → T8
T5 → T6 ──────────┘
```

## Risks / unknowns
- **Huly NetworkPolicy silent-drop** (T6) — budget a debugging hour; verify with a real call, not a port-check.
- **`@hcengineering` in the service runtime** — opens a transactor websocket; pin a Node runtime, confirm the SDK version matches the ops scripts.
- **`proto-app.jsx` is a prototype, not a library** — lift the CSS + the `GateRow`/`Ledger` *patterns*; don't try to import it wholesale.
- **Script format** — start with markdown in-repo (versioned, simple); add a `qa_scripts` table only if in-app authoring is wanted.

## Not now (revisit triggers)
- Whole-cluster-down testing or portal-self-testing → keep a **local** `testing-cli` fallback (offline mode).
- Multiple non-technical testers + case libraries/history → reconsider Qase over a deliberately-minimal build.
- Automatic (non-paste) capture → extend the agentic `@restormel/testing-runner` (Playwright trace) instead.
