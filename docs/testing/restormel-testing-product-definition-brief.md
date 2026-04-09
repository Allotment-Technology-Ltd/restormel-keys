# Restormel / Testing — Product Definition Brief

**Status:** Internal strategy brief  
**Date:** 2026-04-07  
**Product:** Restormel / Testing  
**Suite position:** Second product in the Restormel platform, after Restormel / Keys

## 1. Executive summary

Restormel / Testing should be defined as **open-source agentic testing infrastructure for modern AI products**, built for **local development and CI/CD**, and powered by **BYOK through Restormel / Keys**.

It should not try to replace all existing testing categories. It should not become:
- a thin Playwright wrapper
- a generic prompt eval dashboard
- a generic observability product
- a generic browser agent framework

Instead, it should sit **above** those layers and make them more useful for teams building AI-enabled products. Its core job is to let developers define **goal-based tests** for AI features, browser flows, and agent workflows; execute those tests cheaply with BYOK; compare behaviour across prompts, providers, and versions; and get failure artefacts back that are actually useful inside CI.

This is strategically attractive because it gives Restormel a natural second product that extends the utility of Restormel / Keys rather than bypassing it. It is also commercially sensible because the market is crowded in tooling for prompts, traces, and browser automation, but still relatively weak in practical **workflow-aware testing for real AI products in CI/CD**.

---

## 2. Product definition

**Restormel / Testing is an open-source agentic testing layer for modern AI-enabled software. It helps developers define and run goal-based, workflow-aware tests across browser flows, tool-using agents, prompt-driven features, and retrieval-backed systems in local development and CI/CD, using bring-your-own-key model execution through Restormel / Keys.**

This means the product should be designed around:
- outcome-first testing
- provider-aware execution
- non-deterministic system behaviour
- developer ergonomics in CI/CD
- explicit artefacts, traces, assertions, and verdicts
- modular integration with existing ecosystem tools

**MVP execution honesty (2026):** the shipped runner is **goal + success criteria at a single entry URL** (plus optional Keys-backed judge). It is **not** yet a configurable multi-step autonomous browser agent. Docs and positioning should match that scope until the orchestration layer lands.

---

## 3. Problem statement

Modern AI-enabled applications are hard to test well.

Developers already have mature tooling for deterministic software quality:
- unit tests
- integration tests
- API tests
- browser automation
- static analysis
- performance budgets

Those tools remain necessary, but they are not enough for AI-enabled products.

AI features create a new class of testing problem:
- prompts change behaviour without code changes
- provider swaps alter quality, latency, and failure modes
- browser flows can complete technically while still failing the user’s real goal
- tool-using agents may take different valid paths on different runs
- retrieval-backed flows can degrade gradually rather than failing cleanly
- many existing eval tools are too detached from the actual product runtime

At the same time, brittle scripted E2E suites are expensive to maintain and often still miss the thing that matters most: **did the user outcome happen?**

Restormel / Testing should exist to solve that gap.

---

## 4. Why this should exist now

### 4.1 AI products are moving into normal software delivery
Teams are no longer just experimenting with prompts in notebooks. They are shipping AI features inside products, APIs, agents, and user workflows. That creates pressure for:
- regression detection
- CI gates
- environment-aware testing
- reproducible diagnostics
- cost-controlled evaluation loops

### 4.2 The market is crowded in the wrong places
There are already many products for:
- prompt evaluation
- LLM observability
- browser automation
- generic QA automation
- dataset-based scoring

But those categories still leave a gap for **practical, product-level, agentic testing** that combines:
- app-level goals
- browser execution
- prompt and provider variation
- bounded autonomy
- workflow-aware verdicts
- CI/CD usability

### 4.3 BYOK is now a stronger advantage
Developer teams increasingly want:
- cost control
- provider flexibility
- easier model comparison
- less lock-in to a hosted eval vendor

Restormel / Keys gives Restormel a strong base layer for this. Testing built on top of Keys is a natural product move.

### 4.4 Open source is a strong wedge here
AI testing sits close to core developer workflow and CI. Teams are more likely to adopt an inspectable, composable open-source layer than a black-box hosted tool if they can still keep costs low and retain control over their stack.

### 4.5 Plot is a credible dogfooding target
Plot has exactly the sort of surface area that makes the product real rather than abstract:
- browser-based critical flows
- existing E2E coverage and parity targets
- environment and fixture needs
- payment or subscription flows
- future native/mobile surface area

That makes Plot the right forcing function for MVP scope discipline.

---

## 5. Who it is for

### Primary users
**Developers and small product teams building AI-enabled applications** who need a practical way to test:
- prompt-driven features
- browser-mediated AI flows
- tool-using agents
- retrieval-backed workflows
- provider/model regressions

### Secondary users
**QA and release owners** who need interpretable CI signals, useful failure reports, and better confidence around high-value user journeys.

### Tertiary users
**Open-source maintainers and infra-minded teams** who want repo-native, self-controlled AI testing infrastructure rather than a mandatory hosted platform.

### Not the first target
Not the first target:
- traditional enterprise QA teams with heavy legacy automation estates
- low-code QA buyers looking for broad no-code coverage
- organisations primarily wanting hosted synthetic monitoring

---

## 6. Jobs to be done

Restormel / Testing helps users get these jobs done:

1. **Tell me whether my AI-enabled product still achieves the user outcome I care about.**
2. **Compare behaviour across model, provider, prompt, and workflow changes without rebuilding the whole test stack.**
3. **Run meaningful AI-native tests in CI without depending entirely on brittle selectors and hand-authored scripts.**
4. **Test non-deterministic workflows with structured verdicts instead of pretending everything is binary and deterministic.**
5. **Keep testing costs low by using my own provider keys through Restormel / Keys.**
6. **Explain why a test failed in a way that points toward a fix.**
7. **Adopt AI-native testing incrementally without replacing the rest of my QA stack.**

---

## 7. What testing it includes

## NOW / MVP
Restormel / Testing should include:
- goal-based browser testing for critical user journeys
- AI feature regression testing using rubric or success-criteria checks
- testing of tool-using and retrieval-using workflows
- model/provider comparison execution via Restormel / Keys
- local CLI execution and GitHub Actions support
- run artefacts with steps, verdicts, evidence, and summaries
- retry and indeterminate handling for non-deterministic behaviour
- optional lightweight performance checks for a narrow set of critical routes

## NEXT
Later phases can add:
- native/mobile support via pluggable device runners
- AI-assisted test authoring and generation
- richer regression diffing across prompts/providers/versions
- reusable test packs and fixture libraries
- more advanced workflow-aware diagnostics
- production-linked evaluation loops fed by traces or sampled runs

---

## 8. What testing it excludes

Restormel / Testing should explicitly **not** try to replace:
- unit tests
- type checking
- linting
- migration correctness checks
- static security scanning
- dependency audit tooling
- generic API contract testing
- general-purpose production monitoring
- broad visual regression platforms
- full observability platforms
- full browser automation frameworks

It should also avoid becoming:
- a hosted key vault
- a no-code QA suite for every application type
- a general-purpose prompt playground

The product should stay focused on **workflow-aware, model-aware, outcome-aware testing**.

---

## 9. How it differs from adjacent categories

## 9.1 Versus prompt testing and LLM eval tools
Prompt eval tools are usually strongest when the unit of testing is:
- a prompt
- an LLM output
- a dataset row
- a score across examples

Restormel / Testing is different because the unit of value is the **application-level goal**. That may include:
- browser state
- tool use
- side effects
- workflow completion
- URL/DOM signals
- structured assertions
- environment-specific outcomes

In plain terms:
- prompt eval asks: **“Was this output acceptable?”**
- Restormel / Testing should ask: **“Did the product do the thing the user needed it to do?”**

## 9.2 Versus Playwright wrappers or browser agent tools
Playwright wrappers improve browser scripting. Browser agent tools improve AI-driven browser control.

Restormel / Testing should not compete primarily on selector ergonomics or browser-action syntax. Its value is the **testing contract**:
- goals
- suites
- assertions
- runs
- traces
- verdicts
- reproducible artefacts
- CI wiring
- provider-aware execution

Playwright or browser-agent tooling is a dependency, not the product.

## 9.3 Versus observability products
Observability tools tell you what happened. They are evidence plumbing.

Restormel / Testing should decide whether a test passed, failed, or is indeterminate, and explain the failure in testing terms rather than only showing telemetry.

## 9.4 Versus self-healing QA platforms
Self-healing QA products focus on reducing brittle UI-test maintenance.

Restormel / Testing should borrow that lesson where useful, but its main value is broader:
- AI-native workflow testing
- provider-aware execution
- BYOK control
- CI-friendly contracts
- agentic failure diagnosis

---

## 10. Build vs integrate

## COMMODITY — integrate or adapt
Restormel should default to integrating or adapting existing tools for:
- browser automation engines
- device runners
- baseline tracing / telemetry
- OpenTelemetry export
- generic CI runners
- JUnit / GitHub Checks reporting
- storage backends for artifacts
- prompt scoring libraries where useful
- standard test assertion primitives

## DIFFERENTIATED — build
Restormel should uniquely build:
- the agentic test orchestration layer
- canonical schemas for tests, runs, assertions, traces, verdicts, and reports
- provider-aware execution via Restormel / Keys
- goal-based test authoring for AI-enabled products
- workflow-aware failure analysis
- comparison workflows across model/provider/prompt/version
- bounded-autonomy policies for safe execution
- cheap BYOK-powered CI ergonomics
- AI-native test authoring and generation workflows over time

## ADJACENT — selective later work
Only after wedge validation:
- hosted control plane
- premium dashboards
- retained run history and comparison UI
- commercial support / enterprise governance features
- managed artifact storage and analytics

---

## 11. Open-source wedge

The open-source wedge is not “free testing.” That is too generic.

The real wedge is:

**Open-source, repo-native, BYOK-powered agentic testing for AI products in local development and CI/CD.**

Why this is strong:
- it fits how developers already work
- it lowers adoption friction
- it avoids immediate procurement barriers
- it feels trustworthy in CI because config and behaviour are inspectable
- it aligns naturally with Restormel / Keys rather than conflicting with it
- it is genuinely useful to solo builders and small teams

The open-source product should remain genuinely capable without a hosted dependency.

---

## 12. Relationship to Restormel / Keys and the wider platform

Restormel / Testing should be the first major workflow product built on top of Restormel / Keys.

### 12.1 Platform relationship
- **Restormel / Keys** provides BYOK, provider routing, provider abstraction, and execution control.
- **Restormel / Testing** uses that layer to run model-dependent tests cheaply, consistently, and comparably.
- Future products can then share contracts around runs, traces, verdicts, and policy-aware execution.

### 12.2 Strategic logic
This is a better platform expansion than building a large independent testing stack from scratch because it:
- deepens the usefulness of Keys
- creates a clear cross-product story
- produces reusable contracts for future Restormel products
- keeps the suite focused on developer workflows rather than generic infra categories

### 12.3 Rule
Restormel / Testing should **build on Keys, not bypass it**.

---

## 13. MVP definition

## 13.1 MVP goal
Ship a narrow, real, usable vertical slice that proves Restormel / Testing can replace a meaningful part of brittle scripted browser-journey testing for Plot.

## 13.2 MVP should include
- one CLI
- one repo-native config format
- one GitHub Action
- one browser-backed worker path
- one or two provider integrations via Restormel / Keys
- one `web-critical` suite for Plot
- roughly 5–8 high-value goals
- run artefacts, verdicts, and summaries
- retry/flake handling
- safe defaults for secrets, fork PRs, and network allowlists

## 13.3 MVP should not include
- full native/mobile support
- a large hosted dashboard requirement
- full visual regression support
- enterprise team management
- broad autonomous test generation
- parity with every Plot test immediately
- broad integrations just for completeness

---

## 14. Plot dogfooding plan inside product definition

Plot should be the reference customer for the MVP and early post-MVP work.

### 14.1 First Plot journeys to target
Start with flows that are both high-value and brittle under scripted maintenance pressure:
- authenticated login/session readiness
- onboarding completion
- dashboard readiness
- one or two core domain workflows
- one payment or subscription sandbox flow
- one lightweight performance smoke route

### 14.2 Why Plot is the right dogfood target
Plot can force the product to prove:
- fixture and environment design
- route and suite modelling
- CI usability
- preview/staging support
- flake handling
- cost control
- failure diagnosis quality

### 14.3 Product discipline rule
Nothing should be built for Restormel / Testing just because it sounds impressive. It should earn inclusion through real friction encountered while dogfooding on Plot.

---

## 15. Likely monetisation paths that do not break the open-source strategy

The commercial model should preserve the usefulness of the open-source core.

### Likely safe monetisation paths
1. **Hosted control plane**  
   Managed run orchestration, scheduling, report UI, retained run history, auth, and collaboration.

2. **Premium diagnostics and comparisons**  
   Better diffing across models, prompts, providers, versions, and historical runs.

3. **Managed artifact retention and analytics**  
   Richer trace search, flaky-test analysis, team views, longer retention.

4. **Commercial support and implementation help**  
   Migration from brittle E2E suites, custom adapters, CI hardening, rollout help.

5. **Enterprise policy and governance features**  
   SSO, policy packs, approval workflows, stronger audit views.

### Monetisation paths to avoid
- paywalling basic local execution
- paywalling core CI/CD usage
- forcing a hosted key service
- crippling the open-source runner to force upgrades

### Commercial principle
The open-source product should remain fully legitimate for solo builders and small teams. Paid layers should make adoption easier, more scalable, and more governable, not turn the open-source core into bait.

---

## 16. Risks

### Risk 1 — category confusion
The product could drift into a blurry mix of evals, browser automation, and observability.

**Mitigation:** keep the positioning strict: goal-based agentic testing for AI-enabled apps in local dev and CI/CD.

### Risk 2 — overbuilding too early
It is easy to build infrastructure before the workflow is proven.

**Mitigation:** ship one Plot vertical slice first.

### Risk 3 — noisy non-determinism
AI tests can become flaky or difficult to trust.

**Mitigation:** use rubrics, retries, indeterminate states, evidence-rich verdicts, and clear failure contracts.

### Risk 4 — market crowding
There are already many adjacent tools.

**Mitigation:** do not try to beat promptfoo at prompt evals, Playwright at browser automation, or LangSmith at tracing. Win at orchestration, contracts, workflow, and BYOK-powered testing.

---

## 17. Recommended positioning statement

**Restormel / Testing is open-source agentic testing infrastructure for modern AI products. It helps developers run goal-based, workflow-aware tests across browser and agent flows in local development and CI/CD using bring-your-own-key model execution through Restormel / Keys.**

---

## 18. Recommended launch wedge

The launch wedge should be:

**Use Restormel / Testing to replace a narrow slice of brittle scripted E2E coverage for AI-enabled user journeys, while keeping the rest of your test stack intact.**

That wedge is:
- credible
- narrow enough to ship
- aligned with Plot dogfooding
- strong enough to position the product clearly

---

## 19. Sources consulted

Internal source documents:
- `restormel_testing_chatgpt_project_setup.md`
- [restormel-testing-agentic-product-requirements.md](restormel-testing-agentic-product-requirements.md)
- `repomix-output.md`

External market and ecosystem sources consulted on 2026-04-07 include official docs/sites for:
- Promptfoo
- LangSmith
- Braintrust
- Weights & Biases Weave
- Arize Phoenix
- DeepEval
- Ragas
- Playwright
- Cypress
- Browserbase / Stagehand
- Browser Use
- OpenAI Evals
- mabl
- testRigor
- Functionize
- KaneAI / LambdaTest
- pnpm
- Turborepo
- Changesets
- Vercel monorepo documentation
