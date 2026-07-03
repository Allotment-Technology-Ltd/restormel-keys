---
name: restormel-email-engineering
description: >-
  Best-in-class HTML email engineering for Restormel: the Svelte→HTML render pipeline, table layout +
  inline styles, dark-mode resilience, WCAG accessibility, email-client compatibility, deliverability
  headers, and the test/preview loop. Use when building, debugging, or reviewing any Restormel email
  template, when an email renders wrong (dark-mode muddiness, broken button, Outlook breakage), or when
  wiring a new transactional/marketing email. Pairs with restormel-email-design + restormel-email-copywriting.
---

# Restormel email engineering

How Restormel emails are built so they render correctly, accessibly, and on-brand across the
real-world client matrix. Canonical plan: `planning/email-system-plan.md` (REC-PLAN-028).
Design language: [[restormel-email-design]]. Copy: [[restormel-email-copywriting]].

## The pipeline (Svelte → HTML)
```
theme.ts (──rm-* tokens as email-safe LITERALS)
  → templates/*.svelte (EmailShell + one per email; INLINE styles only)
    → render.ts  (render() from 'svelte/server' → wrapped in an email-safe <!doctype> document)
      → send-mail.ts (Migadu SMTP, transactional)  |  Brevo (marketing, Phase 2)
```
Files: `apps/dashboard/src/lib/server/email/{theme.ts,render.ts,send-mail.ts,templates/}`.

## Hard rules (non-negotiable — clients are not browsers)
1. **Table layout**, single column, `max-width:600px`. No flex/grid (Outlook/Word engine ignores them).
2. **Inline `style=""` only** in templates. **No** scoped `<style>` blocks for layout, **no** `var(--…)`
   (Gmail strips both). All colours/fonts come from `theme.ts` as concrete values.
3. **`<tr>` must be wrapped in `<tbody>`** (the Svelte 5 compiler enforces valid table nesting).
4. **Web-safe font fallbacks carry the layout.** Brand fonts (Barlow Condensed / DM Sans / Space Mono)
   are Google Fonts, absent in most clients — load them as a `<style>` `@import` enhancement only.
5. **Plain-text alternative is mandatory** on every send (deliverability + accessibility).
6. **Borders are the guaranteed brutalist signal; offset `box-shadow` is enhancement** (Outlook drops it).

## Dark mode (the #1 cause of broken Restormel emails)
Many clients (Apple/iOS Mail, Gmail app, Outlook.com) **auto-transform** light emails for dark mode.
Left unmanaged this (a) muddies the cream canvas to brown, and (b) **inverts dark CTA text to white →
white-on-yellow, which fails contrast.** Manage it explicitly:
- Declare `<meta name="color-scheme" content="light dark">` + `supported-color-schemes` and
  `:root{ color-scheme: light dark; }`.
- Ship an explicit dark palette in `@media (prefers-color-scheme: dark)` **and** Outlook.com's
  `[data-ogsc]` / `[data-ogsb]` attribute selectors (it ignores the media query).
- **Force the CTA text colour** so ink-on-yellow never inverts: dark-mode rule sets the button text
  `color:#0c0c0c !important` on yellow. Give targetable `class`es to elements the media query overrides.
- Design an *intentional* dark variant (dark ink canvas, cream text, yellow CTA with ink text) — don't
  let the client improvise. See [[restormel-email-design]] for the palette pairs.

## Accessibility (WCAG 2.2 AA — required)
- **Contrast:** body text ≥ 4.5:1, large text / UI ≥ 3:1, **in both light and dark**. Approved pairs:
  ink `#0c0c0c` on cream `#f3ead0` / on yellow `#ffd600` / on surface `#fffef0`; cream on ink. **Never
  white-on-yellow.**
- Semantic heading (`<h1>`), real text (not images of text), `lang="en"`, descriptive link text
  (no "click here"), body ≥ 14px, tap targets ≥ 44px, meaningful `alt` on every image (empty `alt=""`
  for decorative), `role="presentation"` on layout tables, respect `prefers-reduced-motion`.

## Client compatibility cheatsheet
- **Outlook (Windows/Word engine):** no `box-shadow`, no `flex`/`grid`/`bg-image` reliably; use VML or
  bordered tables for buttons; widths in `px` + `width=` attrs.
- **Gmail:** strips `<head><style>` in some contexts + ignores most media queries; **clips messages > ~102 KB**
  (keep total HTML small); needs inline styles.
- **Apple/iOS Mail:** honours `<style>` + media queries + dark mode; best dark-mode target.

## Deliverability (technical)
- SMTP: Migadu `smtp.migadu.com`, **port 587 / STARTTLS** (not 465), auth var **`SMTP_PASS`**
  (code accepts `SMTP_PASS ?? SMTP_PASSWORD`); transactional `From notify@`, `Reply-To contact@`.
- Subdomain split + per-subdomain SPF/DKIM/DMARC, and **RFC-8058 one-click `List-Unsubscribe`** on all
  **marketing** mail (never transactional). See REC-PLAN-028 §3.1.

## Test & preview loop
- **Unit-test the pure pieces** (subject, plain-text, identity) in vitest. **Do NOT** assert
  `svelte/server` render in the dashboard vitest project — it sets `resolve.conditions:["browser"]`,
  incompatible with server render (`props is not defined`). See [[dashboard-vitest-browser-conditions]].
- **Verify the HTML render** standalone: compile templates with `svelte/compiler` (`generate:"server"`)
  + `render` from `svelte/server`, run from inside `apps/dashboard` so `svelte` resolves; write the HTML
  and open it in a browser (toggle the OS to dark mode to check the dark variant).
- **Send a real test** via Migadu (creds in Infisical `restormel-ops/prod`, see [[restormel-infra-access]]);
  review in an actual dark-mode client before shipping.
