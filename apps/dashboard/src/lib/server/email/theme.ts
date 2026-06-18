/**
 * Email design tokens — the neo-brutalist `--rm-*` palette resolved to literal values
 * that survive email clients.
 *
 * WHY literals (not CSS custom properties): Gmail and most webmail clients strip
 * `<style>` blocks and `var(--…)`, so emails MUST use inline styles with concrete
 * hex / font-stack values. This module mirrors `packages/keys-tokens/src/brutalist-rm.css`
 * so the email look tracks the product design system from one place. If the brand tokens
 * change, update them here too (there is no build-time link — by design, to keep emails
 * dependency-free and client-safe).
 */
export const emailTheme = {
  color: {
    canvas: "#f3ead0", // --color-bg (warm cream page background)
    canvasDeep: "#e8dfbf", // --color-bg-deep
    surface: "#fffef0", // --color-surface (card)
    ink: "#0c0c0c", // --color-ink (text + borders)
    inkMuted: "#3a3530", // --color-ink-muted
    inkFaint: "#7a7060", // --color-ink-faint
    yellow: "#ffd600", // --color-yellow (primary accent fill)
    yellowDark: "#e6bf00", // --color-yellow-dark
    blue: "#1a3f8a", // --color-blue (links / accents)
    onBlue: "#fffef0", // --color-on-blue
    okBg: "#d8f3e3", // --state-ok-bg (success chip)
    okFg: "#166534", // --state-ok-fg
  },
  /**
   * Deliberate DARK-mode variant. Clients (Apple/iOS Mail, Gmail app, Outlook.com) auto-transform
   * light emails for dark mode — left alone this muddies the cream to brown and inverts the CTA's
   * ink text to white-on-yellow (a contrast failure). We ship this explicit dark palette via the
   * render.ts `@media (prefers-color-scheme: dark)` + Outlook `[data-ogsc]/[data-ogsb]` overrides so
   * dark mode looks intentional and stays accessible. CTA stays ink-on-yellow in BOTH modes.
   */
  dark: {
    canvas: "#0c0c0c", // ink canvas
    card: "#1a1812", // raised warm-dark card
    text: "#f3ead0", // cream body text (≥ 12:1 on canvas)
    muted: "#cfc6ad",
    link: "#9db8ff", // lightened blue (AA on dark)
    footer: "#b7ad94",
    border: "#f3ead0", // cream frame on dark
    accent: "#ffd600", // wordmark "Keys" + CTA fill
    chipBg: "#16351f",
    chipFg: "#7ee0a3",
  },
  /**
   * Font stacks: the brand fonts (Barlow Condensed / DM Sans / Space Mono) are Google
   * Fonts and are absent from almost every mail client, so the web-safe fallbacks carry
   * the layout. The brand fonts are loaded as a progressive enhancement via the document
   * `<style>` in render.ts and only show in clients that honour it (e.g. Apple Mail).
   */
  font: {
    // Display: drop 'Arial Narrow' (renders awkward/blurry when faux-condensed) — fall back to a
    // clean bold sans instead, so non-loading clients get crisp wide letters not muddy condensed ones.
    display: "'Barlow Condensed', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    // Body: brand DM Sans, then a native system stack for pin-sharp rendering everywhere.
    body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
  },
  border: "2px solid #0c0c0c",
  /**
   * Offset "hard" shadow — the brutalist signature. Supported in Apple/iOS Mail and most
   * modern clients; silently dropped by the Outlook/Word engine. The 2px ink BORDER is the
   * guaranteed-visible brutalist element; the shadow is enhancement only.
   */
  shadow: "6px 6px 0 #0c0c0c",
  maxWidth: "600px",
} as const;

export type EmailTheme = typeof emailTheme;
