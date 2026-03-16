---
title: Framework compatibility
description: Which package to use for Next.js, React, SvelteKit, Web Components, or headless core. Install paths and when-to-use guidance.
---

Restormel Keys is built to fit the stacks you already use. This page helps you choose the right package and get started quickly.

## Compatibility at a glance

| Framework | Package | Status |
|-----------|---------|--------|
| **Next.js (App Router)** | `@restormel/keys` + `@restormel/keys-react` + `@restormel/keys-elements` | ✅ Supported — primary path |
| **React (generic)** | `@restormel/keys` + `@restormel/keys-react` + `@restormel/keys-elements` | ✅ Supported |
| **SvelteKit** | `@restormel/keys` + `@restormel/keys-svelte` | ✅ Supported — native components |
| **Web Components / Astro / vanilla** | `@restormel/keys` + `@restormel/keys-elements` | ✅ Supported — no framework lock-in |
| **Vue / Nuxt** | — | 🔵 Planned — use headless core or Web Components for now |

All UI paths depend on the headless core (`@restormel/keys`) for resolution, cost, and storage. The React wrapper uses the Web Components under the hood; Svelte uses native Svelte 5 components.

## Install paths

**Headless only (no UI):**

```bash
pnpm add @restormel/keys
```

**Next.js or React (KeyManager, ModelSelector, CostEstimator):**

```bash
pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements
```

**SvelteKit (native Svelte components):**

```bash
pnpm add @restormel/keys @restormel/keys-svelte
```

**Web Components (Astro, vanilla HTML, or any framework):**

```bash
pnpm add @restormel/keys @restormel/keys-elements
```

**CLI (init, add keys, validate, doctor):**

```bash
pnpm add -D @restormel/keys-cli
```

## When to use which

- **Headless core (`@restormel/keys` only)** — You want resolution, cost, and server middleware without any UI. Use when you’re building a custom settings surface or API-only integration.

- **React wrapper (`@restormel/keys-react`)** — You’re in a React or Next.js app and want drop-in KeyManager, ModelSelector, CostEstimator plus hooks (`useKeys`, `useModels`, `useCost`). This is the recommended path for Next.js App Router.

- **Web Components (`@restormel/keys-elements`)** — You need one integration that works in Astro, vanilla HTML, or any framework. Use when you’re not on React or Svelte, or when you want to avoid framework-specific bundles.

- **Svelte components (`@restormel/keys-svelte`)** — You’re on SvelteKit or Svelte and want the native reference implementation (KeyManager, ModelSelector, CostEstimator as Svelte 5 components). Best fit for Svelte-first projects.

## Start with Next.js

If you’re on Next.js App Router, the fastest path is:

1. Install: `pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements`
2. Add a settings (or similar) page with `KeyManager` and your key storage.
3. Use the core on the server for resolution and cost; use the React components on the client for UI.

A full App Router example is available in the repo (`apps/demo-next`). A dedicated Next.js guide will be linked here when added.

## See also

- [Cloud API](/keys/docs/cloud-api/) — gateway URL, Developer Portal, and API reference
- [Dashboard](/keys/dashboard/) — create projects and API keys
- [Sign in](/keys/dashboard/login) — authenticate with GitHub
- [Pricing](/keys/pricing/) — tiers and plans
