# Integration-first reframe audit (Restormel Keys)

**Purpose:** Identify and correct repo drift where Restormel Keys is positioned as a **hosted custodian of raw provider API keys** (or a vault-first gateway) rather than an **integration-first control layer** compatible with external gateways/key hosts and builder-managed secrets.

**Target positioning (v1 default):**
- Restormel issues and manages **Restormel access keys** (Gateway/Restormel API key) for the control plane.
- Provider credentials are **builder-managed** (env/secrets manager), **gateway-backed** (OpenRouter / Vercel AI Gateway / Portkey), or **external secret store references**.
- A hosted provider-secret vault can exist as **future / optional / not default**.

**Legend**
- **Classification:** Copy drift / IA / UX drift / Code/API drift / Data model drift / Pricing/packaging drift / Strategic drift
- **Priority:** **P0** = must fix for correct v1 positioning, **P1** = important alignment, **P2** = cleanup / later

---

## P0 — Must fix (misrepresents the product’s v1 default)

### 1) Landing page implies Restormel returns raw provider secrets
- **File/path**: `apps/dashboard/src/routes/keys/+page.svelte`
- **Exact issue**:
  - Example code uses `getStoredKeys()` and `resolve(model)` returning `{ provider, apiKey }`, then forwards `Authorization: Bearer ${apiKey}`.
- **Why it’s a problem**: It frames Restormel as a system that *stores* and *returns* provider secrets (vault semantics) rather than a control layer that helps you route while keys live in your env / gateway / external secret store.
- **Recommended change**:
  - Change the snippet to **gateway-backed** or **builder-managed** flows:
    - `resolve(model)` returns provider/model decision and optional routing metadata; the app fetches provider access from **its own env** or from a **gateway** (OpenRouter/Portkey/Vercel AI Gateway).
  - Replace `getStoredKeys()` with `getProviderAccessContext()` or `getCredentialRefs()` (no secret material).
- **Classification**: **Code/API drift** + **Copy drift**
- **Priority**: **P0**

### 2) Walkthrough instructs pasting provider secrets into Restormel and claims encrypted storage
- **File/path**: `apps/dashboard/src/routes/keys/docs/walkthrough/phase-1-install/+page.svelte`
- **Exact issue**:
  - Step 1.5: “paste your API key; Restormel validates the key and stores it encrypted.”
  - UI label “Provider Credentials” suggests custody as a normal/default dashboard action.
- **Why it’s a problem**: Overcommits to hosted provider-secret custody as a mainstream/default path.
- **Recommended change**:
  - Reframe Step 1.5 into **Provider access modes**:
    - **External gateway integration** (OpenRouter/Vercel AI Gateway/Portkey): store *gateway key/config* in your infra; Restormel stores **connection metadata** and/or references.
    - **Builder-managed direct providers**: keep provider keys in env/secrets; Restormel resolves to provider/model and you supply the credential.
    - **Future hosted vault**: explicitly “later/optional”, not default.
  - Remove claims of encrypted storage unless explicitly true and default for v1.
- **Classification**: **Strategic drift** + **Copy drift** + **IA / UX drift**
- **Priority**: **P0**

### 3) Verification strategy claims Restormel “re-validates all stored provider keys”
- **File/path**: `apps/dashboard/src/routes/keys/docs/walkthrough/verification-strategy/+page.svelte`
- **Exact issue**:
  - “Re-validates all stored provider keys (makes lightweight test calls to each provider).”
- **Why it’s a problem**: Implies Restormel holds provider secrets and performs active provider calls by default; misleads builders who run provider access via gateways/env vars.
- **Recommended change**:
  - Reframe validation as **provider access health** based on the chosen mode:
    - gateway-backed: validate gateway credentials/config and reachability; optionally validate a small “canary request” through gateway.
    - direct: validate presence of required env vars (no outbound calls unless explicitly configured).
    - hosted vault: explicitly future/optional.
- **Classification**: **Copy drift** + **Code/API drift**
- **Priority**: **P0**

### 4) Pricing includes “stored keys” quotas and “hosted key” framing
- **File/path**: `apps/dashboard/src/routes/keys/pricing/+page.svelte`
- **Exact issue**:
  - Tier description: “1K stored keys… Firestore, Supabase, Postgres.”
  - Overage billed per “keys”.
- **Why it’s a problem**: Positions hosted key custody and adapters as the paid value proposition, conflicting with integration-first control-plane positioning.
- **Recommended change**:
  - Replace “stored keys” with **connections/integrations/config objects** and emphasize paid value in:
    - advanced routing, policies, health monitoring, analytics, audit trail, team, exports.
  - Keep “future hosted vault” in Enterprise roadmap language only.
- **Classification**: **Pricing/packaging drift** + **Strategic drift**
- **Priority**: **P0**

### 5) Legacy product strategy explicitly promises secure hosted key storage + “paste your key” UX as flagship
- **File/path**: `docs/01-product-strategy.md`
- **Exact issue**:
  - “Secure key storage (encrypted at rest…)… users paste their own OpenAI or Anthropic key. Keys handles key storage…”
- **Why it’s a problem**: Conflicts with the stated v1 product model and would set expectations Restormel is a custodian.
- **Recommended change**:
  - Mark as **legacy** and archive, replacing with a short current-truth product note that aligns with `STATUS.md` and `ARCHITECTURE.md` and the new integration guides.
- **Classification**: **Strategic drift**
- **Priority**: **P0**

### 6) Monetisation doc claims “Hosted key encryption” and “Stored keys” as paid feature primitives
- **File/path**: `docs/05-monetisation.md`
- **Exact issue**:
  - Paid (cloud-managed): “Hosted key encryption…”
  - Feature grid row: “Stored keys”
- **Why it’s a problem**: Makes hosted custody central to paid story; mismatched to integration-first proposition.
- **Recommended change**:
  - Rework tiers around control-plane value: routing/policies/health/analytics/team; keep hosted vault as future optional add-on (explicitly later).
- **Classification**: **Pricing/packaging drift** + **Strategic drift**
- **Priority**: **P0**

### 7) Dashboard onboarding says “Billing mode … Restormel-managed”
- **File/path**: `apps/dashboard/src/routes/keys/dashboard/+page.svelte`
- **Exact issue**:
  - “Billing mode — … bring your own keys or Restormel-managed.”
- **Why it’s a problem**: Frames Restormel-managed provider secrets as a current mainstream option.
- **Recommended change**:
  - Replace with **Provider access mode**: gateway-backed vs builder-managed; “future hosted vault” as later.
- **Classification**: **IA / UX drift**
- **Priority**: **P0**

---

## P1 — Important alignment (confusing or inconsistent nouns, reinforces old mental model)

### 8) Core package uses “StoredKeyRecord” as primary concept
- **File/path**: `packages/core/src/storage/types.ts`
- **Exact issue**:
  - Docstring: “A stored key record… adapter may encrypt.”
- **Why it’s a problem**: “Stored key” implies custody; the integration-first model should allow “credential refs / connections” without raw secrets.
- **Recommended change**:
  - Introduce a more general noun like `CredentialRecord` / `ProviderAccessRecord` and keep `StoredKeyRecord` as a compatibility alias.
- **Classification**: **Code/API drift**
- **Priority**: **P1**

### 9) CLI and validate output labels “Stored keys”
- **File/path**:
  - `packages/cli/src/commands/list.ts`
  - `packages/validate/src/index.ts`
  - `packages/validate/dist/index.js` (generated output)
- **Exact issue**:
  - “Show stored keys (masked)”, label “Stored keys”.
- **Why it’s a problem**: Reinforces vault semantics; unclear whether these are local env keys, gateway connections, or dashboard-managed secrets.
- **Recommended change**:
  - Rename labels/output to “Provider credentials (local)” or “Provider access checks” depending on actual behavior; avoid implying Restormel custody.
  - If `dist/` is checked in, ensure it is updated consistently.
- **Classification**: **IA / UX drift** + **Code/API drift**
- **Priority**: **P1**

### 10) Docs overview pushes “KeyManager and your key storage” as default mental model
- **File/path**: `apps/dashboard/src/routes/keys/docs/+page.svelte`
- **Exact issue**:
  - “then add KeyManager and your key storage.”
- **Why it’s a problem**: Defaults the user toward building/storing provider secrets as the centerpiece, rather than plugging into gateway-backed or env-backed access layers.
- **Recommended change**:
  - Reframe quickstart into “choose provider access mode” with pointers to new guides.
- **Classification**: **Copy drift**
- **Priority**: **P1**

### 11) Compatibility page suggests “KeyManager and your key storage” without gateway-first path
- **File/path**: `apps/dashboard/src/routes/keys/docs/compatibility/+page.svelte`
- **Exact issue**:
  - “Add a settings page… KeyManager and your key storage.”
- **Why it’s a problem**: Doesn’t reflect integration-first adoption (gateway-backed, builder env vars).
- **Recommended change**:
  - Add “gateway-backed provider access” as a first-class option; KeyManager becomes optional UX layer.
- **Classification**: **Copy drift**
- **Priority**: **P1**

### 12) Control plane schema references “vault path / encrypted blob id” without clarifying “future/optional”
- **File/path**:
  - `apps/dashboard/migrations/004_control_plane_tables.sql`
  - `docs/reference/control-plane-schema-004.md`
- **Exact issue**:
  - Comments reference “vault path or encrypted blob id” as if vault exists.
- **Why it’s a problem**: Can be read as “Restormel already has a vault.”
- **Recommended change**:
  - Clarify this as **credential_ref to external secret store** (builder-managed) and/or future hosted vault; avoid implying Restormel runs a vault by default.
- **Classification**: **Data model drift**
- **Priority**: **P1**

### 13) Demo app positioning “server-side key storage and resolution”
- **File/path**: `apps/demo-next/README.md`
- **Exact issue**:
  - “server-side key storage and resolution… settings UI…”
- **Why it’s a problem**: Overweights storage as core product; should instead show integration-first + progressive adoption.
- **Recommended change**:
  - Update demo narrative: builder-managed secrets or gateway-backed; KeyManager becomes optional for end-user BYOK (builder-managed store).
- **Classification**: **Copy drift**
- **Priority**: **P1**

---

## P2 — Cleanup / consistency (important but can follow after core reframing lands)

### 14) Prompt packs and reference docs still describe Keys as “AI gateway” or “key manager”
- **File/path**:
  - `internal/prompts/restormel-prompt-pack.md` (local-only)
  - `internal/prompts/restormel-cursor-implementation-prompt-pack.md` (local-only)
  - various `docs/reference/*` notes
- **Exact issue**:
  - Broad “AI gateway and control plane” framing without explicit “complements external gateways; not a vault by default.”
- **Why it’s a problem**: Agents and contributors will regenerate old assumptions back into docs/UI.
- **Recommended change**:
  - Update prompt-pack framing language to “control layer / overlay” and explicitly list external gateway compatibility; mark vault as future.
- **Classification**: **Strategic drift**
- **Priority**: **P2**

### 15) “Cloud API” page is Zuplo-centric and calls dashboard keys “API keys”
- **File/path**: `apps/dashboard/src/routes/keys/docs/cloud-api/+page.svelte`
- **Exact issue**:
  - “create projects and API keys” language; “exposed through a Zuplo gateway…”
- **Why it’s a problem**: Confusing taxonomy (Gateway Key vs consumer key vs management) and over-couples the story to Zuplo.
- **Recommended change**:
  - Clarify: Cloud API is Restormel control plane; gateway is optional deployment edge; emphasize compatibility with other gateways and direct access patterns.
- **Classification**: **Copy drift**
- **Priority**: **P2**

---

## Recommended terminology (apply consistently)
- **Restormel Gateway Key**: authenticates to Restormel’s control plane (format `rk_...`).
- **Provider access mode**: how requests reach providers (gateway-backed, builder-managed direct, future hosted vault).
- **Integration / connection**: configured provider-access layer (OpenRouter/Vercel/Portkey/direct providers).
- **Provider credential**: upstream secret owned by builder or gateway vendor; not default-hosted by Restormel.

