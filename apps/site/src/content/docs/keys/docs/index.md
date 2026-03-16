---
title: Restormel Keys docs
description: Documentation for Restormel Keys — drop-in BYOK and provider routing for AI apps.
template: splash
hero:
  title: "Restormel Keys docs"
  tagline: "Drop-in BYOK and provider routing for AI apps. Get started in minutes."
  actions:
    - text: Framework compatibility
      link: /keys/docs/compatibility/
      icon: right-arrow
      variant: primary
    - text: Keys landing
      link: /keys/
      icon: external
      variant: minimal
    - text: Pricing
      link: /keys/pricing/
      icon: external
      variant: minimal
---

Restormel Keys adds multi-provider routing and production-grade key management to your app. This doc set covers install, framework choice, and API.

## Start with Next.js

Using **Next.js App Router**? Install the core plus React and Web Components, then add KeyManager and your key storage. Full path: [Framework compatibility](/keys/docs/compatibility).

```bash
pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements
```

## Pick your framework

One core; different wrappers. Use the headless API for resolution and cost on the server; add UI (KeyManager, ModelSelector, CostEstimator) where it fits.

| Framework | Package path | Status |
|-----------|--------------|--------|
| Next.js / React | `@restormel/keys` + `@restormel/keys-react` + `@restormel/keys-elements` | ✅ Supported |
| SvelteKit | `@restormel/keys` + `@restormel/keys-svelte` | ✅ Supported |
| Web Components / Astro / vanilla | `@restormel/keys` + `@restormel/keys-elements` | ✅ Supported |
| Vue / Nuxt | Headless or elements for now | 🔵 Planned |

[Framework compatibility](/keys/docs/compatibility) has install commands, when-to-use guidance, and the full Next.js walkthrough.

## Quick links

- [Cloud API](/keys/docs/cloud-api/) — API reference, gateway URL, and Developer Portal (Try it)
- [Keys landing](/keys) — what Keys is, modes, comparison, pricing
- [Pricing](/keys/pricing) — tiers and FAQ
- [Restormel](https://restormel.dev/) — homepage
