# Restormel logo pack — Quad Router (neo-brutalist v2)

**Canonical product assets** live in `apps/dashboard/static/` and are rendered in-app via [`RestormelLogo.svelte`](../apps/dashboard/src/lib/components/RestormelLogo.svelte).

The mark is a **four-quadrant router**: Keys (blue), Graph (neon), Testing (coral), Knowledge (canvas), with a neon resolve kernel, blueprint registration ticks, and I/O port tabs. Hard offset shadow; no rounded corners.

## Files (this pack)

| File | Use |
|------|-----|
| `restormel-mark-icon-transparent.svg` | Mark only — favicon, avatars, tight UI |
| `restormel-app-header-lockup.svg` | Nav lockup (mark + RESTORMEL + accent rules) |
| `restormel-favicon.svg` | Favicon (canvas field + mark) |
| `restormel-mark-export.svg` | Legacy 1024×1024 export tile — **superseded** by brutalist mark; regenerate from static when needed |
| `restormel-lockup-export.svg` | Legacy dark lockup — **superseded** by `apps/dashboard/static/restormel-lockup-brutalist.svg` for hero |

## Colours (neo-brutalist v2)

| Token | Hex | Role |
|-------|-----|------|
| Canvas | `#F0E6D2` | Page / Knowledge quadrant |
| Ink | `#000000` | Borders, wordmark, shadow |
| Neon | `#FFDE4D` | Resolve kernel, Graph quadrant, accents |
| Blueprint blue | `#4D96FF` | Keys quadrant, registration ticks |
| Coral | `#FF6B6B` | Testing quadrant |
| White | `#FFFFFF` | Mark module fill |

## Placement (in product)

- **Nav / header / sidebar:** `RestormelLogo variant="lockup"` height 28–32px
- **Login / hero:** `RestormelLogo` height 36px+ or `restormel-lockup-brutalist.svg`
- **Favicon:** `favicon.svg`
- **Collapsed sidebar / icon-only:** `RestormelLogo variant="mark"`

See [docs/design/design-system-index.md](../docs/design/design-system-index.md) for sizing rules.
