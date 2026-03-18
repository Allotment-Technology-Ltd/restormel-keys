# Developer portal navigation (UX reference)

**Canonical operational detail:** [zuplo-developer-portal-go-live.md](../runbooks/zuplo-developer-portal-go-live.md).

## Industry practice (summary)

| Pattern | Why |
|--------|-----|
| **Persistent “back to product”** | API docs often live on a different host (e.g. Zuplo). Users need an always-visible path to the main app, not only search. |
| **Logo → product home** | Familiar convention; reduces “stranded” feeling. |
| **Same-tab links when SSO matters** | Opening the portal in the same tab preserves session cookies on the IdP domain (`restormel.dev`). |
| **Footer + nav redundancy** | Pricing and legal links stay discoverable if header is minimal. |
| **Docs vs API reference** | Separate mental models: *guides* on `restormel.dev/keys/docs`, *Gateway OAS + Try it* on the Zuplo portal. |

## What Restormel does

- **restormel.dev:** Header includes **API portal**; **Pricing** moved to the account menu (when signed in) and remains in the **footer** for everyone.
- **Dashboard:** Topbar **API portal**, sidebar **API portal** (same tab), avatar menu **Pricing**; Access page explains portal + consumer key.
- **Docs:** Sidebar link **API portal**.
- **Zuplo portal:** Tab **On restormel.dev** (Keys, Documentation, Dashboard), logo → `/keys`, introduction copy explains how to leave the portal.

## Shared branding / CSS

The portal is a **static Zudoku build** on Zuplo; it cannot share Svelte/CSS bundles with the dashboard. What *is* possible:

- **Logo image** from `restormel.dev` (SVG URL).
- **Nav links** to product URLs.
- **Copy** aligned with Restormel Keys terminology.
- **Optional:** small custom CSS via Zudoku if the platform allows (higher maintenance).

Full visual parity with the dashboard is usually not worth the cost; **navigation + logo + voice** are the high-leverage fixes.
