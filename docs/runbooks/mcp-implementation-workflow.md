# MCP Implementation Workflow

## Overview
Use `@restormel/mcp` when you want a tool surface inside an IDE, agent, or automation runner (via MCP stdio).

This runbook focuses on wiring the MCP server/tools so your agent workflow can:
- list and validate model/provider availability
- estimate cost and explain routing decisions
- check entitlements/policy access
- scaffold integration config and search offline docs

## Target use-cases
- IDE/agent tool calling: agent needs to call Restormel tools at runtime.
- Debugging and pre-flight validation inside agent workflows.
- Automated “select model -> estimate cost -> explain routing -> proceed” flows.

## Prerequisites
1. Dependencies installed:
   - `@restormel/mcp`
   - `@restormel/keys`
2. Your environment provides provider credentials needed for:
   - `providers.validate`
   - `cost.estimate`
   - (optional) `entitlements.check` remote evaluation
3. MCP client configuration knows how to start the stdio binary:
   - `restormel-mcp` (stdio, runs in your agent/IDE process context)

## Implementation steps
1. Start the MCP server (stdio transport)
   - Configure your MCP client to run `restormel-mcp`.
2. Use CLI commands to establish baseline routing/cost expectations
   - `npx @restormel/doctor`
   - `npx keys routing explain <model>`
   - `npx keys estimate <model> -i <inputTokensM> -o <outputTokensM>`
3. In your agent workflow, call MCP tools in the intended order
   - `models.list` to inventory candidates
   - `providers.validate` to confirm provider access
   - `cost.estimate` to compute estimated cost for token volume
   - `routing.explain` to obtain routing explanations
   - `entitlements.check` for plan/policy gating
   - `integration.generate` / `docs.search` to scaffold integration/config and locate docs
4. Connect entitlements policy evaluation (if needed)
   - Local rules: set `RESTORMEL_MCP_CONFIG`
   - Remote evaluation: set `RESTORMEL_EVALUATE_URL` + `RESTORMEL_GATEWAY_KEY`

## Verification commands
- `npx @restormel/doctor`
- `npx keys models list`
- `npx keys estimate <model> -i <inputTokensM> -o <outputTokensM>`
- `npx keys routing explain <model>`

## Operator workflow example
1. Call `GET /api/projects/{projectId}/providers/health` and confirm each bound provider has `health=ok` or a clear remediation path.
2. Call `GET /api/projects/{projectId}/route-coverage` to verify each required stage/workload tuple has an enabled route.
3. Call `GET /api/projects/{projectId}/readiness` and resolve any `high` severity issues before rollout.
4. Call `POST /api/projects/{projectId}/routes/{routeId}/recommend` to inspect non-breaking improvements before changing route order/policies.

## Production readiness checklist
- Ensure your MCP client only enables tools that do not write to stdout (MCP protocol uses stdout for tool transport).
- Handle tool error states in the agent workflow:
  - unknown model pricing
  - provider access failures
  - policy/entitlement denials
- Keep policy evaluation and credential handling privacy-safe:
  - never log raw provider API keys
  - surface masked identifiers only

## References (related functionality)
- `@restormel/keys`: models, routing, and pricing primitives
- `@restormel/validate`: provider validation logic (CI-friendly)
- `@restormel/doctor`: sanity checks and actionable “what to fix next”
- `@restormel/aaif`: alternative structured contract surface for app/service hosts

