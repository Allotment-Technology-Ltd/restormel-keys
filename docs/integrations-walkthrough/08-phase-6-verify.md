# Phase 6 — Verify and go live

> **Time:** ~10 minutes  
> **Prerequisites:** At least one of Phase 2 (CLI), Phase 3 (MCP), or Phase 4 (AAIF) complete  
> **You'll need:** Terminal, Dashboard access

This phase confirms your Integrations setup is correct and gives you a short checklist for "go live" (e.g. documenting the setup, adding CLI to CI, or shipping agent prompts).

---

## Step 6.1 — CLI verification

If you use the CLI:

1. Run `npx keys doctor` — exit 0.
2. Run `npx keys models list` — you see at least one provider's models.
3. Run `npx keys routing explain <model>` for a model you use — you see a resolution path.

### How to test

All three commands complete without errors.

---

## Step 6.2 — Dashboard verification

1. Open [Developer Tools](https://restormel.dev/keys/dashboard/dev-tools).
2. Confirm the overview shows CLI, MCP, AAIF cards.
3. Open the tab for your chosen surface (CLI, MCP, or AAIF) and confirm the content matches your setup (e.g. CLI tab shows install status and command list).
4. For operator readiness, verify runtime APIs:
   - `GET /api/projects/{projectId}/providers/health`
   - `GET /api/projects/{projectId}/route-coverage`
   - `GET /api/projects/{projectId}/readiness`
   - `POST /api/projects/{projectId}/routes/{routeId}/recommend`
5. For policy lifecycle parity, verify:
   - `GET /api/policies/{id}/history`
   - `POST /api/policies/{id}/publish`
   - `POST /api/policies/{id}/rollback`
   - `POST /api/policies/{id}/diff`

---

## Step 6.3 — Document and share

- Add a short section to your repo README or internal docs: "Restormel Integrations" with links to the CLI quickstart and/or MCP/AAIF docs.
- If you use the CLI in CI, add a step that runs `keys doctor` (and optionally `keys validate`).
- If you implemented with agent prompts, keep the [Prompt index](09-prompt-index.md) link so others can re-run the same sequence.

---

## Step 6.4 — Go live checklist

- [ ] At least one surface (CLI / MCP / AAIF) installed and verified.
- [ ] Dashboard Developer Tools and usage path set.
- [ ] Doc links (or README) updated.
- [ ] Optional: CLI in CI; agent prompts documented for your team.

---

## Checkpoint

You now have:

- CLI and/or Dashboard checks passing.
- Documentation and (optional) CI or agent-prompt workflow in place.
- Integrations walkthrough complete.
