# Integration-first reframe — implementation summary

This summary records the repo-wide product and documentation reframing away from “Restormel stores users’ raw provider API keys” and toward “Restormel integrates cleanly with external gateways/key hosts/provider access layers (OpenRouter, Vercel AI Gateway, Portkey) and builder-managed direct provider setups.”

## What changed (high-level)

- **Product narrative**: Restormel Keys is now described as an **integration-first control layer** (routing, policies, health, analytics/cost, and embeddable UX) that *slots into* an existing provider access layer rather than replacing it.
- **Key ownership**: Copy now emphasizes that **Restormel-owned keys** are for **Restormel control-plane access** (Gateway/Restormel API key). Provider credentials are **gateway-backed** or **builder-managed** by default.
- **Future hosted vault**: Kept as **future/optional** (explicitly not v1 default).

## Docs/pages/routes/components updated

### Landing + docs overview + pricing

- `apps/dashboard/src/routes/keys/+page.svelte`
  - Reframed hero and feature language toward “control layer for provider access.”
  - Updated code snippet to avoid implying Restormel returns raw provider secrets.
- `apps/dashboard/src/routes/keys/docs/+page.svelte`
  - Added provider access mode framing and links to the new Guides pages.
- `apps/dashboard/src/routes/keys/pricing/+page.svelte`
  - Removed “stored keys” framing and re-centered value on control-plane features.
- `docs/05-monetisation.md`
  - Reframed tiers and value away from hosted provider-secret storage.

### Walkthrough fixes (remove default hosted-custody assumptions)

- `apps/dashboard/src/routes/keys/docs/walkthrough/phase-1-install/+page.svelte`
  - Reworked Step 1.5 into explicit **provider access modes** and positioned dashboard credential custody as **not default**.
- `apps/dashboard/src/routes/keys/docs/walkthrough/verification-strategy/+page.svelte`
  - Reframed `keys validate` as mode-aware provider access verification (gateway-backed or builder-managed direct).
- `apps/dashboard/src/routes/keys/docs/walkthrough/phase-5-ui/+page.svelte`
  - Removed language implying Restormel-hosted custody; clarified BYOK is builder-managed.

### New integration-first guides (in docs journey)

Added as first-class pages under `/keys/docs/guides/*` and linked from the docs sidebar:

- `apps/dashboard/src/routes/keys/docs/guides/provider-access-modes/+page.svelte`
- `apps/dashboard/src/routes/keys/docs/guides/openrouter/+page.svelte`
- `apps/dashboard/src/routes/keys/docs/guides/vercel-ai-gateway/+page.svelte`
- `apps/dashboard/src/routes/keys/docs/guides/portkey/+page.svelte`
- `apps/dashboard/src/routes/keys/docs/guides/integration-vs-hosted-vault/+page.svelte`
- Sidebar updates: `apps/dashboard/src/routes/keys/docs/+layout.svelte`

Also created the requested repo-level guide files as pointers to the canonical published docs pages:

- `docs/guides/openrouter-integration.md`
- `docs/guides/vercel-ai-gateway-integration.md`
- `docs/guides/portkey-integration.md`
- `docs/guides/provider-access-modes.md`
- `docs/guides/integration-vs-hosted-vault.md`

### Dashboard IA/UX wording alignment (URLs unchanged)

- `apps/dashboard/src/lib/nav-config.ts`
  - Renamed nav labels from “Provider Integrations” → **“Integrations”** (href unchanged).
- `apps/dashboard/src/routes/keys/dashboard/+page.svelte`
  - Replaced “Billing mode … Restormel-managed” with **Provider access mode** guidance and link to the new guide.

### Package/interface wording alignment (non-breaking)

- `packages/core/src/storage/types.ts`
  - Introduced `CredentialRecord` and kept `StoredKey` as a backwards-compatible alias.
- `packages/cli/src/commands/list.ts`
  - CLI output now says **provider credentials (local, masked)** instead of “stored keys.”
- `packages/validate/src/index.ts`
  - Output labels now avoid “Stored keys” language and instead use “Provider credentials (local)” / “Credential (provider)”.
- `packages/svelte/src/KeyManager.svelte`
  - User-facing labels updated from “key” to “credential” where appropriate (component name unchanged).

## Terminology changes (key ones)

- **“Stored keys”** → **“Provider access modes / integrations / provider credentials (local)”** (depending on context)\n
- **Provider secrets**: no longer positioned as “stored in Restormel” by default; instead **gateway-backed** or **builder-managed**.\n
- **Integration-first framing**: explicit mention of **OpenRouter / Vercel AI Gateway / Portkey** as complementary layers.

## What remains intentionally future-facing

- **Hosted provider-secret vault** is explicitly framed as **future / optional / not default** (kept as a door-open concept, not the v1 identity).

## Legacy docs treatment (local-only vs canonical)

To avoid perpetuating wrong assumptions, several legacy planning docs were replaced with “current truth” pointers. The legacy material is kept **local-only** under `internal/strategy/archive/` (not published in the public repo).

## Follow-up tasks recommended

- Update any remaining docs/UI strings that still imply default hosted provider-secret storage (search terms: “stored keys”, “stores it encrypted”, “vault”).
- Decide whether the dashboard “Integrations” screen needs clearer sub-labels for gateway-backed vs direct-provider vs BYOK-builder-managed (copy only; keep URLs stable).
- Align `CHANGELOG.md` and `STATUS.md` with the updated integration-first positioning if any remaining sections still overcommit to custody semantics.

