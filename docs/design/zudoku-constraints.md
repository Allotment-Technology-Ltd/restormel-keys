# Zudoku portal — Restormel design constraints

Reference note for the developer portal design pass (Build 1B). Records what the
Restormel neo-brutalist design system can and cannot express within Zudoku
(version **0.71.7**, the version pinned in `zuplo-gateway/docs/package.json`).

Primary files:
- `zuplo-gateway/docs/zudoku.config.ts` — theme tokens, fonts, metadata, branding, code-sample languages
- `zuplo-gateway/docs/restormel-theme.css` — injected via `theme.customCss`
- `zuplo-gateway/docs/pages/introduction.md` — landing page
- `zuplo-gateway/config/routes.oas.json` — OpenAPI tags (drive the API-reference nav groups)

---

## Fully applied

- **Colour system.** All 20 shadcn theme variables are mapped to Restormel
  tokens in `theme.light` / `theme.dark` (cream background, warm-white cards,
  yellow primary, ink text/borders, yellow focus ring). Hex values are used
  verbatim — Zudoku only HSL-wraps space-separated triples.
- **Squared corners.** `radius: "0rem"` zeroes `--radius`; Zudoku derives
  `--radius-sm/md/lg/xl` from it, so the whole UI loses its rounding without a
  global `* { border-radius }` hammer (which would have squared avatars/spinners).
- **Body + code fonts.** `theme.fonts.sans = "DM Sans"`, `theme.fonts.mono =
  "Space Mono"` — both are Zudoku built-in Google fonts, auto-imported.
- **Display headings.** Barlow Condensed (900, uppercase) on `h1–h4`. It is not
  a Zudoku built-in font, so it is loaded through the otherwise-unused
  `theme.fonts.serif` slot (a valid `@import` at the top of Zudoku's virtual
  stylesheet) and applied via `var(--font-serif)` in the custom CSS.
- **Sidebar.** Cream panel, ink border, yellow active/hover — set through the
  real `--sidebar*` variables. `customCss` is injected unlayered, so it wins
  over Zudoku's `layer(theme)` defaults without `!important`.
- **Branding + metadata.** Logo (Restormel lockup SVG), `site.title`,
  `metadata.title/description/favicon` all set.
- **Landing page.** `introduction.md` (the `/` redirect target) carries the
  display heading, mono tagline, intro paragraph, three "Start here" links, and
  the authentication note.
- **Navigation groups.** OAS tags re-grouped into product language —
  *Knowledge graph, Ingest jobs, Verification, Model routing, API keys & auth*
  (plus Suite/System) — with a top-level `tags` array for order + descriptions.
  `expandAllTags: true` shows them all.
- **Code-sample languages.** `examplesLanguage: "js"`, `supportedLanguages`
  limited to JavaScript / Python / cURL; Java, C#, PHP removed.

## Partially applied (with constraint)

- **Card offset shadows + hard borders.** The signature 4px offset (un-blurred)
  shadow is applied via `.bg-card` and `button.bg-primary` selectors in the
  custom CSS. These are **utility-class selectors**, stable in 0.71.x but not
  contractual — flagged SPECULATIVE in the CSS and worth a visual check after
  any Zudoku upgrade. Corners/colours themselves come from the tokens and are
  not speculative.
- **Tagline typography.** The landing tagline renders in Space Mono via inline
  code (`` `Route. Ingest. Retrieve. Verify.` ``) because plain Markdown can't
  set a per-line font/size/colour. The intent (small mono) is met; exact
  size/muting would need an MDX component.
- **Page-title format.** `metadata.title` = "Restormel API Reference" and
  `site.title` match, but the exact "{endpoint} — Restormel API" separator is
  composed by Zudoku internally; the literal em-dash format isn't configurable.
- **"Get your API key" link.** Points to the portal's `/my-keys` (the real
  consumer-key page) rather than the spec's `https://restormel.dev/dashboard/keys`,
  which is not a valid path in this product. Terminology kept as *consumer key
  (`zpka_…`)* to match the rest of the portal (the gateway edge credential).

## Not possible within Zudoku theming (would need a custom portal build)

- **HTTP method badge colours.** GET/POST/DELETE/PUT/PATCH are coloured with
  Tailwind text-color utilities (`text-green-600`, `text-sky-600`,
  `text-red-600`, …) applied inline by Zudoku's OpenAPI renderer. Overriding
  those utility classes would recolour unrelated text across the portal, so a
  true Restormel badge treatment (yellow POST, ink DELETE, outlined GET) needs a
  component eject or a custom-built portal.
- **Forcing light mode / removing the dark toggle.** Zudoku 0.71.7 exposes no
  config to set a default colour mode or disable the switch. The full Restormel
  dark palette is provided as a fallback so dark mode stays on-brand.
- **Quick-link deep links to individual operations.** The API reference is a
  single `/api` page; stable per-operation anchors aren't guaranteed across
  versions, so the landing "Start here" links point at `/api` and name the
  operation in text.
- **Arbitrary React injection / OpenAPI panel layout.** Out of scope without
  ejecting Zudoku, per the framework's documented limits.
