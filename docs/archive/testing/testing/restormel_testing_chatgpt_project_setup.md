# Restormel / Testing — ChatGPT Project Setup

## Purpose
This document sets up a dedicated ChatGPT project for **Restormel / Testing**, the second product in the Restormel suite after **Restormel / Keys**.

Restormel / Testing is an **agentic testing product**. It should begin as an **open-source, developer-first product** that uses **Restormel / Keys** for BYOK and provider routing, and fits naturally into CI/CD workflows.

The immediate goal is to:
- define the product clearly
- produce core product and technical documentation
- identify what should be built vs integrated
- create a realistic MVP plan
- start implementation and dogfood the product on **PLOT**

---

## Recommended ChatGPT Project Name
**Restormel / Testing**

Optional longer name:
**Restormel / Testing — Agentic Testing Product**

---

## Recommended Project Description
Restormel / Testing is an open-source agentic testing product in the Restormel platform suite. It helps developers add AI-native and agentic testing into CI/CD workflows using bring-your-own-key model execution through Restormel / Keys. The product should integrate with existing testing, browser automation, observability, and evaluation tools where possible, while building differentiated value in test orchestration, failure analysis, agentic test generation, reasoning-aware diagnostics, and developer workflow.

The product will be dogfooded on Plot and should be designed so it can later support other Restormel products and external developer teams.

---

## Project Instructions
You are working on **Restormel / Testing**, the second product in the Restormel suite after **Restormel / Keys**.

Strategic context:
- Restormel is the platform.
- Restormel / Keys is the first product and provides BYOK and multi-provider routing.
- Restormel / Testing must build on Keys rather than bypass it.
- The product should begin as **open source**, developer-first, and practical.
- The first real dogfooding target is **PLOT**.
- The product must be useful in CI/CD, not just as an interactive demo.

Core product thesis:
Restormel / Testing is an **agentic testing product** for modern AI-enabled applications and agent workflows.
It should help teams test:
- AI features and prompts
- agent workflows
- browser or UI flows involving AI
- regression across model/provider changes
- tool-using or retrieval-using flows
- evaluation-style test suites in CI/CD

Build-vs-integrate rule:
Do **not** reinvent mature categories unless there is a clear reason.
Default to integrating or adapting existing tools for:
- browser automation
- standard E2E execution
- tracing / telemetry
- baseline eval metrics
- generic prompt testing
- generic CI runners
- existing test frameworks

Default to building differentiated Restormel value for:
- agentic test orchestration layer
- model/provider-aware test execution via Restormel / Keys
- reusable contracts for test cases, runs, assertions, traces, and verdicts
- failure diagnosis across agent steps, tool use, model choice, and prompt changes
- regression comparison across providers, prompts, and versions
- AI-native test authoring and test generation workflows
- reasoning-aware or workflow-aware explanation of test failures
- developer ergonomics for cheap BYOK-powered CI/CD testing

Market-aware constraint:
Do not turn Restormel / Testing into just another:
- Playwright wrapper
- generic prompt eval harness
- generic observability dashboard
- generic browser agent framework

It should sit **above** those layers and make them more useful.

Preferred framing:
Restormel / Testing should be positioned as:
**open-source agentic testing infrastructure for modern AI products, built for CI/CD and powered by BYOK through Restormel / Keys**.

Product expectations:
- practical, modular, and cheap to run
- open-source first
- useful to solo builders and small teams
- usable locally and in CI/CD
- capable of testing both deterministic and non-deterministic AI flows
- designed so dogfooding on Plot is straightforward

Architecture guidance:
- inspect existing repo state before proposing rewrites
- modular first
- package boundaries before repo splitting
- preserve working behaviour where possible
- prefer vertical slices over giant rewrites
- define canonical schemas for tests, runs, artifacts, assertions, traces, and reports
- ensure Keys integration is a first-class concern

When producing outputs:
- be strategic but practical
- classify work as COMMODITY, DIFFERENTIATED, or ADJACENT
- identify what should be reused from the ecosystem
- identify what Restormel should uniquely build
- explain tradeoffs clearly
- mark work as NOW, NEXT, LATER, or DO NOT BUILD
- avoid generic startup advice

Preferred outputs:
- product strategy docs
- MVP specs
- architecture notes
- package plans
- open-source repo structure proposals
- prompt packs for implementation
- backlog structures
- launch and dogfooding plans
- docs suitable for developers and contributors

Important reminder:
Restormel / Testing should use the open ecosystem where possible, but win through orchestration, diagnostics, developer workflow, and BYOK-powered agentic testing.

---

## Suggested Source Documents to Add to the Project
Add these as source documents if available:
- platform strategy
- package boundary spec
- monorepo folder blueprint
- Restormel master index
- deep research report
- any Restormel / Keys strategy, product, pricing, architecture, or docs material
- any Plot product docs relevant for dogfooding targets

---

## Starter Prompt 1 — Product Definition
You are helping define **Restormel / Testing**, the second product in the Restormel suite after Restormel / Keys.

Restormel / Testing is an **open-source agentic testing product** built on Restormel / Keys BYOK technology so that developers can run AI-native and agentic tests cheaply in local and CI/CD workflows.

I want you to produce a full **product definition document** that covers:
- problem statement
- who it is for
- what jobs it helps users get done
- what exact kinds of testing it includes and excludes
- how it differs from generic prompt eval tools, Playwright wrappers, and observability products
- how it fits within the wider Restormel platform
- why this should exist now
- what the open-source wedge is
- what the likely monetisation paths could eventually be without damaging the open-source strategy

Make the output explicit about:
- what should be integrated from the market
- what should be uniquely built by Restormel
- what the MVP should and should not include
- how Plot should be used for dogfooding

Structure the output as a serious internal strategy/product brief.

---

## Starter Prompt 2 — Competitive Landscape
I want a competitive landscape review for **Restormel / Testing**.

Research and analyse the current landscape across:
- prompt testing and LLM eval tools
- agent evaluation tools
- browser automation and agent browser tools
- open-source testing frameworks
- CI/CD testing integrations
- AI observability tools
- test generation tools
- self-healing test products

For each competitor or category:
- explain what it does
- classify whether it is open source, commercial, or hybrid
- explain where it is strong
- explain where it is weak
- explain whether Restormel / Testing should integrate with it, compete with it, or avoid it

Then provide:
- a market map
- a gap analysis
- a build-vs-integrate recommendation
- a positioning recommendation for Restormel / Testing
- a recommended wedge for launch

Be commercially realistic and avoid hand-wavy claims.

---

## Starter Prompt 3 — MVP Spec
Produce a realistic **MVP specification** for Restormel / Testing.

Constraints:
- open-source first
- built on Restormel / Keys
- should be cheap to run via BYOK
- should work in local development and CI/CD
- first dogfooding target is Plot
- should avoid rebuilding mature infrastructure unnecessarily

Include:
- MVP goals
- non-goals
- core user journeys
- system components
- package or module boundaries
- CLI and config needs
- test definition model
- run artifacts and report model
- Keys integration points
- external tools to integrate with first
- what to build in phase 1 vs phase 2
- success criteria

Make sure the MVP is small enough to actually ship.

---

## Starter Prompt 4 — Technical Architecture
Design the initial technical architecture for Restormel / Testing.

I want:
- a modular architecture
- package recommendations
- canonical schemas for tests, runs, assertions, traces, and reports
- recommendations for integration with Keys
- recommendations for browser automation and CI execution
- recommendations for observability and artifact storage
- clear separation between commodity layers and differentiated Restormel layers

Please classify each subsystem as:
- COMMODITY
- DIFFERENTIATED
- ADJACENT

Then propose the minimum viable architecture for launch.

---

## Starter Prompt 5 — Dogfooding on Plot
Help me design a **dogfooding plan** for using Restormel / Testing on Plot.

I want:
- the best target user journeys in Plot to test first
- which tests should be deterministic vs model-graded
- which tests should run on every commit vs nightly vs pre-release
- how to keep costs low using BYOK
- how to structure golden datasets / fixtures / scenarios
- how to identify flaky tests in AI workflows
- how to use the dogfooding loop to improve both Plot and Restormel / Testing

Output a practical phased plan.

---

## Starter Prompt 6 — Documentation Backlog
Create a **documentation backlog** for Restormel / Testing.

I need the docs required to build and launch this as an open-source project.

Include:
- README
- product overview
- getting started
- install guide
- CI/CD guide
- configuration reference
- test definition reference
- Keys integration guide
- architecture overview
- contributor guide
- roadmap
- dogfooding guide for Plot
- examples library

For each document include:
- purpose
- target audience
- suggested filename
- rough outline
- priority order

---

## Starter Prompt 7 — First Engineering Backlog
Create the first engineering backlog for Restormel / Testing.

I want:
- epics
- milestones
- sequence of implementation
- technical dependencies
- what should be built first for a usable vertical slice
- what can be stubbed initially
- what should be deferred

Assume a solo founder, limited time, and strong need to ship something real.

---

## Starter Prompt 8 — Open Source Launch Plan
Create an open-source launch plan for Restormel / Testing.

Include:
- repo shape
- licence considerations
- examples strategy
- contributor friendliness
- initial launch scope
- docs expectations
- demo plan
- how to tie it into Restormel / Keys without making it feel locked down
- how to message the relationship between the two products

Make the answer practical and launch-oriented.

---

## Suggested Immediate Working Sequence
1. Product definition
2. Competitive landscape
3. MVP spec
4. Architecture
5. Dogfooding on Plot
6. Documentation backlog
7. Engineering backlog
8. Open-source launch plan

---

## Recommended Initial Positioning Draft
Restormel / Testing is an open-source agentic testing product for modern AI-enabled software. It helps developers run AI-native, workflow-aware, and browser-capable tests in local and CI/CD environments using bring-your-own-key model execution through Restormel / Keys. Rather than replacing existing test runners, eval tools, or browser frameworks, it aims to unify them into a cheaper, more practical, developer-friendly workflow for testing AI products.

