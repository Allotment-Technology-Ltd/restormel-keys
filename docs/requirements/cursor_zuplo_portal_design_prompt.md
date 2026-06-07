# Cursor Prompt: Zuplo Developer Portal — Restormel Design Alignment
# Model: Sonnet 4.6
# Run alongside or immediately after Phase 1 of the API implementation plan
# File: zuplo-gateway/docs/zudoku.config.ts (primary) + any injected CSS

---

## Context

The Restormel API is documented through a Zuplo developer portal powered by
Zudoku. A developer who reaches the portal after using the dashboard must feel
like they are in the same product — same palette, same typographic voice, same
aesthetic. Currently the portal uses Zudoku's default theme, creating a jarring
context switch.

Zudoku supports: theme token overrides, custom CSS injection, logo and branding,
landing page (intro) content customisation, navigation labels, metadata.

Zudoku does NOT support: full override of its HTML component structure, arbitrary
React component injection (without ejecting), deep customisation of the OpenAPI
renderer panels.

This prompt applies the Restormel design as far as the framework allows.
Where Zudoku constraints prevent full neo-brutalist implementation, get as close
as possible and note the constraint clearly in a comment.

---

## Step 1 — Read the current state

Before making any changes, read:
- zuplo-gateway/docs/zudoku.config.ts in full
- Any existing CSS file referenced in the Zudoku config (custom.css, theme.css,
  or similar)
- zuplo-gateway/docs/zudoku-setup.md or any documentation runbook that
  describes the portal setup
- The Zudoku documentation for theme configuration (if accessible in the
  codebase or referenced in package.json — check the installed Zudoku version
  and its theme API surface)

Report what the current config contains and what theming hooks are available
before implementing anything.

---

## Step 2 — Theme token overrides

In zudoku.config.ts, apply the Restormel design tokens to the Zudoku theme
configuration. Map each Restormel token to the closest Zudoku theme variable.

The Restormel token system to apply:

COLOURS:
  Background:      #F3EAD0   (warm cream — page background)
  Surface:         #FFFEF0   (warm white — card/panel backgrounds)
  Primary accent:  #FFD600   (yellow — primary actions, active states)
  Ink:             #0C0C0C   (near-black — text, borders)
  Muted:           #3A3530   (body text, descriptions)
  Faint:           #7A7060   (metadata, footnotes, secondary labels)
  Border:          #0C0C0C   (2px solid)

If Zudoku uses a dark mode by default, set the default to light mode using
the cream background. If dark mode cannot be disabled, apply the Restormel
dark palette:
  Dark background: #1A1917
  Dark surface:    #242220
  Dark primary:    #FFD600   (yellow remains the accent in dark mode)
  Dark ink:        #F3EAD0   (cream becomes the text colour in dark mode)

TYPOGRAPHY:
  Set display/heading font to: 'Barlow Condensed', sans-serif
  Set code/monospace font to:  'Space Mono', monospace
  Set body font to:            'DM Sans', sans-serif

  Add the Google Fonts import to the portal. If Zudoku supports a head
  injection or metadata config, add it there. Otherwise add to the custom
  CSS file:
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');

---

## Step 3 — Neo-brutalist CSS injection

Create or update the custom CSS file referenced in the Zudoku config.
Apply these rules as far as the Zudoku DOM structure allows.
Every rule should have a comment explaining what it targets.

```css
/* ── RESET BORDER RADIUS ── */
/* Zudoku uses rounded corners throughout; remove them for neo-brutalist aesthetic */
*, *::before, *::after {
  border-radius: 0 !important;
}

/* ── BORDER SYSTEM ── */
/* Apply 2px solid black borders to card and panel elements */
/* Adjust selectors to match actual Zudoku DOM — inspect and update */
[class*="card"],
[class*="panel"],
[class*="sidebar"],
[class*="endpoint"] {
  border: 2px solid #0C0C0C !important;
}

/* ── OFFSET SHADOWS ── */
/* Apply offset (not blur) shadows to interactive cards */
[class*="card"]:not([class*="nav"]),
[class*="operation"],
[class*="endpoint-card"] {
  box-shadow: 4px 4px 0 #0C0C0C !important;
}

/* ── TYPOGRAPHY ── */
/* Force heading elements to use Barlow Condensed */
h1, h2, h3, h4, [class*="heading"], [class*="title"] {
  font-family: 'Barlow Condensed', sans-serif !important;
  font-weight: 900 !important;
  text-transform: uppercase !important;
  letter-spacing: -0.01em !important;
}

/* Force code elements to use Space Mono */
code, pre, [class*="code"], [class*="mono"] {
  font-family: 'Space Mono', monospace !important;
}

/* Force body text to use DM Sans */
body, p, li, td, [class*="description"], [class*="body"] {
  font-family: 'DM Sans', sans-serif !important;
}

/* ── BUTTONS ── */
/* Apply neo-brutalist button treatment */
button, [role="button"], [class*="btn"], a[class*="button"] {
  border: 2px solid #0C0C0C !important;
  border-radius: 0 !important;
  font-family: 'Space Mono', monospace !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  transition: transform 80ms ease, box-shadow 80ms ease !important;
}

/* Primary action buttons get yellow fill */
[class*="btn-primary"], [class*="button-primary"],
button[class*="primary"] {
  background: #FFD600 !important;
  color: #0C0C0C !important;
  box-shadow: 3px 3px 0 #0C0C0C !important;
}
[class*="btn-primary"]:hover,
button[class*="primary"]:hover {
  transform: translate(-2px, -2px) !important;
  box-shadow: 5px 5px 0 #0C0C0C !important;
}

/* ── HTTP METHOD BADGES ── */
/* Style GET/POST/DELETE etc. badges to match Restormel tag aesthetic */
[class*="method-get"]    { background: transparent !important; color: #0C0C0C !important; border: 2px solid #0C0C0C !important; }
[class*="method-post"]   { background: #FFD600 !important; color: #0C0C0C !important; border: 2px solid #0C0C0C !important; }
[class*="method-delete"] { background: #0C0C0C !important; color: #FFFEF0 !important; border: 2px solid #0C0C0C !important; }
[class*="method-put"],
[class*="method-patch"]  { background: transparent !important; color: #0C0C0C !important; border: 2px solid #0C0C0C !important; }

/* ── SIDEBAR NAVIGATION ── */
[class*="sidebar"] {
  background: #E8DFBF !important; /* --color-bg-deep */
  border-right: 2px solid #0C0C0C !important;
  box-shadow: none !important;
}

/* Active nav item */
[class*="nav-item"][class*="active"],
[class*="sidebar-item"][aria-current] {
  background: #FFD600 !important;
  color: #0C0C0C !important;
  font-weight: 700 !important;
}

/* ── RESPONSE CODE INDICATORS ── */
[class*="response-2"] { border-left: 4px solid #FFD600 !important; }
[class*="response-4"] { border-left: 4px solid #0C0C0C !important; }
[class*="response-5"] { border-left: 4px solid #0C0C0C !important; }

/* ── REDUCED MOTION ── */
@media (prefers-reduced-motion: reduce) {
  button, [role="button"] {
    transition: none !important;
  }
}
```

IMPORTANT: After adding these rules, note in a comment at the top of the CSS
file which selectors were confirmed against the actual Zudoku DOM and which
are speculative. If you can inspect the built Zudoku output to confirm
selector names, do so and update the rules accordingly. Speculative selectors
may need adjustment after visual testing.

---

## Step 4 — Branding and identity

In zudoku.config.ts, update:

LOGO:
  Set the portal logo to the Restormel logo mark (the ⬡ RESTORMEL mark).
  If Zudoku supports an SVG or image path for the logo, reference the
  existing logo asset from the dashboard. If no logo asset path is
  accessible from the Zuplo gateway repo, set the text fallback to
  "RESTORMEL" in Barlow Condensed.

SITE METADATA:
  title: "Restormel API Reference"
  description: "Route model requests with fallback chains and stand up
  agent-ready knowledge infrastructure — in one signed-in workspace,
  with direct providers and BYOK custody."
  favicon: reference the Restormel favicon if accessible

PAGE TITLE FORMAT:
  "{endpoint name} — Restormel API" (not the Zudoku default)

---

## Step 5 — Landing page / intro content

The developer portal landing page (the page a developer sees before browsing
endpoints) should not be the Zudoku default. Update the intro/landing content
in zudoku.config.ts (or a referenced markdown/MDX file if that is how Zudoku
handles it) with:

HEADING: "RESTORMEL API REFERENCE"
  Styled as Tier 1 display type (Barlow Condensed 900, uppercase)

TAGLINE: "Route. Ingest. Retrieve. Verify."
  In Space Mono, small, muted

INTRO PARAGRAPH:
  "The Restormel API gives you programmatic access to Keys routing,
  knowledge graph ingestion, verified retrieval, and agent context
  — using your own provider keys, your own graph store, and your
  own data. No proxy. No lock-in."

THREE QUICK LINKS (if Zudoku supports a card/link grid on the landing page):
  1. "INGEST YOUR FIRST DOCUMENT" → links to POST /connect/v1/ingest/jobs section
  2. "QUERY YOUR KNOWLEDGE GRAPH" → links to POST /connect/v1/graph section
  3. "GET YOUR API KEY" → links to https://restormel.dev/dashboard/keys

AUTHENTICATION NOTE (below the cards):
  "All API requests require a gateway key (zpka_…) passed as
  Authorization: Bearer {key}. Generate yours in the Restormel dashboard."
  In Space Mono, small.

If Zudoku does not support a rich landing page, apply as much of the above
as the config permits and note what was not possible.

---

## Step 6 — Navigation and endpoint grouping

Update the sidebar navigation labels and grouping to match Restormel's
product language — not generic REST terminology.

GROUPS (rename if current names differ):
  "Ingestion" → "Ingest jobs"
  "Retrieval" → "Knowledge graph"
  "Verification" → "Verification"
  "Keys" → "Model routing"
  "Webhooks" → "Webhooks"
  "Authentication" → "API keys & auth"

If Zudoku generates navigation from the OAS tags, update the tags in
zuplo-gateway/config/routes.oas.json to match these group names.

---

## Step 7 — Code sample language

Ensure the portal defaults to showing code samples in the languages most
relevant to Restormel's developer audience. If Zudoku has a language
preference config, set:
  Default: TypeScript / JavaScript
  Also show: Python, curl
  Remove or deprioritise: Java, C#, PHP (not the primary audience)

---

## Constraints to document

At the end of this prompt's implementation, produce a brief note at
docs/design/zudoku-constraints.md listing:
- Which Restormel design elements were fully applied
- Which were partially applied (with the constraint explained)
- Which could not be applied within Zudoku's theming system and would
  require a custom portal build to achieve

This note becomes the reference for future portal design decisions.

---

## What not to change

- The OpenAPI spec content itself (endpoint descriptions, schemas) —
  that is covered in the API implementation plan phases
- The Zuplo routing or policy configuration — this is design only
- Any dashboard application code
