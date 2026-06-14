---
title: AAIF Implementation Workflow
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-19
last-reviewed: 2026-03-20
review-interval: P12M
---

# AAIF Implementation Workflow

## Overview
Use AAIF (`@restormel/aaif`) when your app/service wants a stable, typed request/response contract with explicit routing context and spend constraints.

This runbook focuses on integrating the AAIF runtime helper (`executeAAIFRequest`) with `@restormel/keys` so you can:
- resolve `provider/model` deterministically
- estimate cost from token-volume hints
- surface an auditable `routing.reason`
- (optionally) delegate final `output` generation to your host

## Target use-cases
- In-app agent orchestration: your application decides how to route model work.
- Pre-flight checks: validate routing + estimated cost before calling an LLM.
- Tooling consistency: align internal app decisions with CLI `routing explain` and `cost estimate`.

## Prerequisites
1. Dependencies installed:
   - `@restormel/keys`
   - `@restormel/aaif`
2. Your project has Restormel Keys configured with:
   - provider access (BYOK keys and/or platform keys)
   - routing defaults (`routing.defaultProvider`, routing rules if applicable)
3. You know which model(s) you will support for each AAIF `task`.

## Implementation steps
1. Validate request/response payloads with runtime guards
   - Use `isAAIFRequest()` before calling the runtime helper.
   - Use `isAAIFResponse()` if you persist or forward responses.
2. Create a `keys` instance
   - Use the `createKeys()` SDK function from `@restormel/keys`.
   - Ensure your configured providers include models you will route to.
3. Build an `AAIFRequest` contract for your host boundary
   - Always provide `input`.
   - Optionally provide:
     - `task`: `"chat" | "completion" | "embedding"`
     - `constraints.maxCost` to cap estimated spend
     - `constraints.latency` for your routing policy
     - `constraints.tokens.{inputTokensM, outputTokensM}` to improve cost estimation accuracy
     - `routing.{model, provider}` to align with your preferred route (optional)
4. Resolve + estimate + generate response via the runtime helper
   - Call `executeAAIFRequest(request, keys, options)`.
   - Provide a `generate` callback if you want the host to supply final `output` without embedding secrets inside `@restormel/aaif`.
   - Handle errors:
     - invalid request payload -> treat as caller error
     - unknown model pricing -> treat as configuration error
     - `maxCost` exceeded -> treat as “do not proceed” decision
5. Wire debugging/telemetry
   - Persist `response.routing.reason` and `response.cost` for traceability.
   - Do not log secrets; the runtime helper does not expose raw key material.

## Verification commands (CLI-aligned)
Use CLI commands to ensure routing/cost decisions match what your runtime helper will do.
- `npx @restormel/doctor`
- `npx keys models list`
- `npx keys estimate <model> -i <inputTokensM> -o <outputTokensM>`
- `npx keys routing explain <model>`

## Production readiness checklist
- Error states are handled for:
  - invalid AAIF payloads
  - unknown model/pricing
  - `maxCost` exceeded
  - misconfigured routing defaults
- Token volume hints are either:
  - provided by your app for deterministic cost estimates, or
  - defaulted knowingly (runtime defaults to `1M` input and `1M` output)
- No raw provider API keys are logged or included in errors.
- The host supplies final `output` via `generate` (recommended) or consumes the default `output = request.input` placeholder.

## Operator workflow example
1. Validate provider trust and readiness first (`providers/health`, `route-coverage`, `readiness`).
2. Send AAIF requests with `constraints.maxCost` and optional `constraints.tokens` for deterministic budget control.
3. When costs/policies block decisions, inspect `resolve` and `simulate` `decisionMetadata` and route recommendations before policy changes.
4. For policy changes, use policy `history/publish/rollback/diff` endpoints to keep an auditable lifecycle.

## References (related functionality)
- `@restormel/keys`: routing + cost estimation primitives
- `@restormel/validate`: provider configuration validation
- `@restormel/doctor`: repository/config sanity checks
- `@restormel/mcp`: alternative integration surface for agent tool calls

