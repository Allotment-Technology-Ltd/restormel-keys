---
name: restormel-email-design
description: >-
  Graphic design + UX/UI for Restormel emails — the neo-brutalist visual system applied to the inbox:
  accessible colour pairs (light AND dark), type hierarchy, layout, the brutalist frame, CTA design, and
  mobile/responsive behaviour. Use when designing or critiquing the look/feel of any Restormel email, when
  fixing off-palette or low-contrast rendering, or before sending an email for review. Pairs with
  restormel-neu-brutalist-ui (in-app), restormel-email-engineering (build), restormel-email-copywriting.
---

# Restormel email design (graphic / UX / UI)

Make Restormel emails look unmistakably on-brand (neo-brutalist) and read effortlessly in every inbox,
light or dark. In-app design language: [[restormel-neu-brutalist-ui]]. Implementation rules:
[[restormel-email-engineering]]. Tokens: `apps/dashboard/src/lib/server/email/theme.ts`.

## Palette — use the brand tokens, nothing else
Only `--rm-*` values (resolved literals in `theme.ts`). **There is no brown in the system** — brown in a
rendered email is a dark-mode auto-transform artefact (a bug), not a palette choice. Core values:
`canvas #f3ead0`, `surface #fffef0`, `ink #0c0c0c`, `ink-muted #3a3530`, `yellow #ffd600`, `blue #1a3f8a`,
success `#d8f3e3`/`#166534`.

### Accessible pairs (WCAG AA) — the only combinations to use
| Use | Light | Dark variant |
|-----|-------|--------------|
| Body text | ink on cream / surface | cream `#f3ead0` on ink `#0c0c0c` |
| **Primary CTA** | **ink `#0c0c0c` on yellow `#ffd600`** | **ink on yellow (force it — never let it invert)** |
| Link / accent | blue `#1a3f8a` on cream | a lightened blue/cream on ink (keep ≥4.5:1) |
| Card frame | 2px ink border + offset ink shadow | 2px cream border (shadow optional) |
**Banned:** white text on yellow (the classic dark-mode inversion failure), low-contrast grey-on-cream,
any colour outside the tokens.

## Dark mode is a design deliverable, not an afterthought
Design BOTH variants deliberately so the email looks intentional when a client switches:
- Light: cream canvas, near-white card, ink text + frame, yellow CTA (ink text).
- Dark: ink/charcoal canvas, slightly raised dark card, cream text, **cream** frame, yellow CTA (ink text).
Hand the pairs to [[restormel-email-engineering]] to wire via `@media (prefers-color-scheme: dark)` +
`[data-ogsc]/[data-ogsb]`.

## Layout & hierarchy (UX)
- Single column, ≤600px, generous padding (≥24px), one idea per band.
- Clear order: **wordmark → status chip (optional) → display headline (the outcome) → 1–3 short
  paragraphs → ONE primary CTA → plain fallback link → footer**. Primary CTA above the fold.
- The brutalist frame: hard 2px border defines the card (always visible); offset shadow lifts it
  (enhancement, may drop in Outlook). Flat fills, square corners (`radius 0`), no soft SaaS gradients.

## Type
- Display headline in the condensed display font (web-safe fallback `Arial Narrow`/Arial), heavy weight,
  tight leading. Body in the sans (DM Sans → Arial), ≥15px, line-height ~1.6. Mono (Space Mono → Courier)
  for the wordmark, chips, button label, footer — uppercase, letter-spaced. Body text never below 14px.

## CTA button (the part that broke)
Yellow `#ffd600` fill, 2px ink border, ink label, uppercase mono, ≥44px tall, generous horizontal padding.
**The label colour must be forced** so dark-mode can't invert it to white. Bulletproof table-cell button
(see engineering). Make it look pressable: offset shadow under it in light mode.

## Mobile / responsive
Fluid to 100% under ~620px, tap targets ≥44px, single column stacks, no fixed pixel widths that overflow.

## Pre-send review checklist
- [ ] Renders correctly in **dark** mode (no brown, frame visible, CTA = ink-on-yellow). 
- [ ] All text pairs pass AA in both modes. 
- [ ] One primary CTA, above the fold, ≥44px. 
- [ ] Only `--rm-*` colours. 
- [ ] Reads well as plain text. 
- [ ] Looks right at 320px width.
Imagery (rare in email): route via [[restormel-design-imagery]]; prefer real text over images-of-text.
