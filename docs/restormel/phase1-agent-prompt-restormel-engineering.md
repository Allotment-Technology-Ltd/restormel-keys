# Phase 1 — agent prompt (Restormel engineering)

**Single source of truth:** Use **this file** for the exact **agent prompt** text, **links**, and **acceptance pointers** so implementation does not drift. The companion spec is **[phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md)**.

**Sync rule:** If the same filenames exist on SOPHIA `main`, reconcile **links, package names, and § references** with this copy after each milestone; prefer **this repo’s** version for npm/publish and CI truth.

---

## Slack / email pointer (short)

Use verbatim for stakeholders:

Implement and publish `@restormel/contracts`, `@restormel/observability`, `@restormel/graph-core` (Contract v0), `@restormel/ui-graph-svelte`, and lift `@restormel/graph-reasoning-extensions` from SOPHIA `packages/graph-reasoning-extensions`. Full objectives, acceptance tests, non-goals, and SOPHIA spec paths are in SOPHIA `docs/restormel/phase1-agent-prompt-restormel-engineering.md` and `docs/restormel/phase1-restormel-engineering-spec.md`. After release, SOPHIA will swap `@sophia/graph-reasoning-extensions` → `@restormel/graph-reasoning-extensions` per §6 of the engineering spec.

That completes SOPHIA’s Phase 1 extraction documentation; the remaining work is Restormel monorepo publish + API stability, then SOPHIA’s dependency bump per the reintegration checklist.

---

## Agent prompt (copy from the next line through “End of prompt.”)

You are implementing the Restormel platform packages for **Phase 1** of the SOPHIA → Restormel extraction: shared contracts, observability, graph Contract v0, Svelte graph UI, and reasoning extensions as **separate publishable packages** under `@restormel/*`.

**Scope**

1. **Implement and publish** (npm, CI, semver policy):
   - `@restormel/contracts` — **`packages/contracts`** in restormel-keys (ported from SOPHIA).
   - `@restormel/observability` — **`packages/observability`** (depends on contracts).
   - `@restormel/graph-core` (**Contract v0** only — DTOs + layout / trace / workspace; **no** `@restormel/contracts` inside MVP graph-core) — already in **`packages/graph-core`**.
   - `@restormel/ui-graph-svelte` — **`packages/ui-graph-svelte`**.
   - `@restormel/graph-reasoning-extensions` — **`packages/graph-reasoning-extensions`** (compare, lineage, projection, …; depends on contracts + graph-core).

2. **Authorities — read before changing behaviour or acceptance language**
   - **This monorepo:** [docs/restormel/phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md) (objectives, §6 reintegration, non-goals, SOPHIA path references).
   - **Graph extraction map:** [docs/restormel/04-delivery/restormel-graph-sophia-extraction-artifacts.md](./04-delivery/restormel-graph-sophia-extraction-artifacts.md)
   - **SOPHIA consumer / Vite / npm:** [docs/restormel-graph-sophia-consumer.md](../restormel-graph-sophia-consumer.md)
   - **Public integrator doc (graph UI):** `https://restormel.dev/graph/docs/integration/sveltekit` — must stay aligned with published packages and `ssr.noExternal` for **both** `@restormel/ui-graph-svelte` and `@restormel/graph-core`.
   - **SOPHIA programme docs** (when on default branch): `docs/restormel/phase1-restormel-engineering-spec.md` and `docs/restormel/phase1-agent-prompt-restormel-engineering.md` in the SOPHIA repository — use for file-level acceptance tests and port maps; **reconcile** with this file if wording diverges.

3. **After release**
   - SOPHIA replaces `@sophia/graph-reasoning-extensions` with `@restormel/graph-reasoning-extensions` per **§6** of [phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md).
   - Remaining work: Restormel **monorepo publish + API stability**, then SOPHIA **dependency bump** per the **reintegration checklist** in SOPHIA Phase 1 / migration documentation.

4. **Guardrails**
   - Follow `docs/security-baseline.md` — no committed secrets or realistic secret placeholders.
   - Do not fold reasoning-heavy modules into `graph-core` v0; use `graph-reasoning-extensions` or app adapters.
   - Do not treat CLI/MCP as the only integration path; site docs on restormel.dev remain primary for step-by-step integration.

**Deliverables check**

- Packages build, test, and publish via documented tag/workflow patterns.
- Root `CHANGELOG.md` and package READMEs updated; npm READMEs link to `https://restormel.dev/graph/docs` where applicable.
- Consumer smoke and dashboard doc route checks pass where already defined in CI.

End of prompt.
