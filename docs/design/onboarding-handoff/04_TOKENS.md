# 04 · Design tokens

Every value the mocks use, with its resolved hex/size. **These already exist in the codebase**
(`packages/keys-tokens/src/base.css` + `brutalist-rm.css`, surfaced as CSS custom properties and
the `.btn`/`.card`/`.brut-*` classes in `apps/dashboard/src/app.css` +
`brutalist-utilities.css`). **Reuse the real tokens — do not hard-code these hexes in
components.** This table is for verification and for any value that's missing upstream.

The canonical standalone copy is `designs/styles.css` (every value inlined, zero build step) —
useful as a reference and to diff against the real token package.

## Colours

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f3ead0` | warm cream page canvas |
| `--color-bg-deep` | `#e8dfbf` | recessed / hover wells |
| `--color-surface` | `#fffef0` | near-white card / input surface |
| `--color-yellow` | `#ffd600` | **primary accent / the one true CTA** |
| `--color-yellow-dark` | `#e6bf00` | yellow pressed/hover |
| `--color-blue` | `#1a3f8a` | secondary module accent (info banners, text/border) |
| `--color-ink` | `#0c0c0c` | text + **all borders** + **all shadows** |
| `--color-ink-muted` | `#3a3530` | muted body text |
| `--color-ink-faint` | `#7a7060` | captions / disabled / queued |
| `--signal-teal` | `#2ec4b6` | success / verified / live |
| `--amber-insight` | `#ffb84d` | warning / insight / "needs you" |
| `--coral-alert` | `#f25c54` | error / failed |
| `--coral-alert-active` | `#d94e47` | error pressed (= `--brut-coral`) |
| `--violet-depth` | `#9d84b7` | reasoning accent |

Code panel (dark): `--code-bg #1c1917`, `--code-fg #fffef0`, `--code-keyword #ffd600`,
`--code-value #7ecba8`, `--code-comment #969089`, `--code-accent #bfa8ff`.

State chips: ok `#d8f3e3`/`#166534`, warn `#fef3c7`/`#92400e`, fail `#fee2e2`/`#991b1b`.

## Borders, shadows, radius (the neo-brutalist core)

| Token | Value |
|---|---|
| `--border` | `2px solid #0c0c0c` |
| `--border-thin` | `1.5px solid #0c0c0c` |
| `--shadow-sm` | `3px 3px 0 #0c0c0c` |
| `--shadow-md` | `5px 5px 0 #0c0c0c` |
| `--shadow-lg` | `7px 7px 0 #0c0c0c` |
| radius | **`0` everywhere** (square — this is non-negotiable to the look) |

Shadows are **hard, offset, no blur**. Interactive cards/buttons translate on hover
(`translate(-2px,-2px)` + bigger shadow) and press in on active (`translate(2px,2px)` + smaller
shadow) over `transform .08s ease`.

## Typography

Three families (Google Fonts, already loaded by the token layer):
- `--font-display`: **"Barlow Condensed"**, 700/900, `text-transform: uppercase`, tight tracking
  (`-0.01em`), line-height `0.95`. All display headings.
- `--font-mono`: **"Space Mono"**, 400/700. Labels, buttons, eyebrows, metadata, code.
  Tracking `0.08em`, uppercase for labels/buttons.
- `--font-body`: **"DM Sans"**, 400/500/600. Body copy, line-height `1.65`.

Scale: display xl/lg/md/sm = `78 / 52 / 32 / 22 px`; hero `clamp(3.5rem,7vw,6rem)`; metric
`clamp(3rem,6vw,4.5rem)`. Body lg/md/sm = `16 / 15 / 14 px`. Mono labels sm/md/lg =
`10 / 11 / 13 px`.

## Spacing (4px base)

`--space-1..20` = `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px` (1=4px, 2=8px, 3=12px, 4=16px,
5=20px, 6=24px, 8=32px, 10=40px, 12=48px, 16=64px, 20=80px).

## Buttons (use the real classes)

- `.btn` base: mono, 12px, 700, tracking `0.06em`, uppercase, 2px border, radius 0, min-height
  **44px**, `8px 18px` padding.
- `.btn-primary` — yellow fill, ink text, `shadow-sm` → lifts on hover. The **only** yellow on a
  screen should be the single primary action.
- `.btn-outline` / `.btn-secondary` — surface fill. `.btn-ghost` — transparent, fills `bg-deep`
  on hover. `.btn-danger` — coral text/border. `.btn-lg`, `.btn-inline` size variants.

## Inputs

`.input` / `.brutal-input`: full-width, min-height 44px, 2px ink border, radius 0, surface
background, yellow focus outline (`2px solid #ffd600`). Field label = `.brutal-label` (mono,
uppercase, 10px). Required marker coral.

## Accessibility floors

- Hit targets ≥ **44px** (buttons/inputs already enforce it).
- Yellow focus ring on all focusables.
- `prefers-reduced-motion`: transitions disabled (already handled in the stylesheet) — carry this
  into any new animation.

## Mapping to the codebase

1. Confirm `packages/keys-tokens` exposes all of the above (it should — `styles.css` was inlined
   *from* it). If a value is missing, add it there, not in a component.
2. Use the semantic `rm-*` aliases where they exist (`--rm-surface`, `--rm-card-shadow`,
   `--rm-font-display`, …) — they're in the token layer too.
3. New onboarding components should carry **no colour/spacing literals** — only token vars and
   the shared utility classes.
