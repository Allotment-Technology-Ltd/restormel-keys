/**
 * Render a Svelte email template to a complete, email-client-safe HTML document.
 *
 * Templates are authored as `.svelte` components with INLINE styles that are the LIGHT defaults
 * (so clients that strip <style> still get the correct light brutalist look). The document <style>
 * below adds: the brand web-font @import (progressive enhancement), and an explicit DARK-mode
 * variant via `@media (prefers-color-scheme: dark)` plus Outlook.com's `[data-ogsc]/[data-ogsb]`
 * attribute hooks — keyed to `rm-*` classes on the template elements. This makes dark mode an
 * intentional design (not a muddy auto-transform) and keeps the CTA ink-on-yellow in both modes.
 * See restormel-email-engineering / restormel-email-design skills.
 */
import { render } from "svelte/server";
import type { Component } from "svelte";
import { emailTheme as t } from "./theme";

const d = t.dark;

export function renderEmailDocument<P extends Record<string, unknown>>(
  component: Component<P>,
  props: P,
): string {
  const { head, body } = render(component, { props });
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Restormel Keys</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap");
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0 !important; padding:0 !important; background:${t.color.canvas}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
  /* Crisp text on dark mode + retina (fixes "blurry" heavy headlines in Apple Mail/WebKit). */
  .rm-h1, .rm-body, .rm-body p, .rm-wordmark { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  @media only screen and (max-width:620px) {
    .rm-fluid { width:100% !important; max-width:100% !important; }
    /* Mobile CTA: prevent label wrapping on narrow viewports */
    .rm-cta a, a.rm-cta-link { white-space:nowrap !important; font-size:11px !important; padding:12px 18px !important; letter-spacing:0.04em !important; }
  }
  /* ── Intentional dark-mode variant ── */
  @media (prefers-color-scheme: dark) {
    body, .rm-canvas { background:${d.canvas} !important; }
    .rm-card { background:${d.card} !important; border-color:${d.border} !important; }
    .rm-header { border-bottom-color:${d.border} !important; }
    .rm-wordmark, .rm-h1, .rm-h2, .rm-body, .rm-body p { color:${d.text} !important; }
    .rm-accent { color:${d.accent} !important; }
    .rm-muted { color:${d.muted} !important; }
    .rm-link { color:${d.link} !important; }
    .rm-footer { color:${d.footer} !important; }
    .rm-chip { background:${d.chipBg} !important; color:${d.chipFg} !important; border-color:${d.border} !important; }
    .rm-chip-warn { background:${d.chipWarnBg} !important; color:${d.chipWarnFg} !important; border-color:${d.border} !important; }
    .rm-cta { background:${t.color.yellow} !important; border-color:${t.color.ink} !important; box-shadow:3px 3px 0 ${d.border} !important; }
    .rm-cta a, a.rm-cta-link { color:${t.color.ink} !important; }
    /* Notice block (e.g. password-reset reassurance box) */
    .rm-notice { background:${d.card} !important; border-color:${d.border} !important; color:${d.muted} !important; }
    .rm-notice td { color:${d.muted} !important; }
  }
  /* ── Outlook.com dark mode (ignores the media query) ── */
  [data-ogsb] body, [data-ogsb] .rm-canvas { background:${d.canvas} !important; }
  [data-ogsb] .rm-card { background:${d.card} !important; }
  [data-ogsc] .rm-card { border-color:${d.border} !important; }
  [data-ogsc] .rm-wordmark, [data-ogsc] .rm-h1, [data-ogsc] .rm-h2, [data-ogsc] .rm-body, [data-ogsc] .rm-body p { color:${d.text} !important; }
  [data-ogsc] .rm-accent { color:${d.accent} !important; }
  [data-ogsc] .rm-muted { color:${d.muted} !important; }
  [data-ogsc] .rm-link { color:${d.link} !important; }
  [data-ogsc] .rm-footer { color:${d.footer} !important; }
  [data-ogsb] .rm-chip { background:${d.chipBg} !important; }
  [data-ogsc] .rm-chip { color:${d.chipFg} !important; border-color:${d.border} !important; }
  [data-ogsb] .rm-chip-warn { background:${d.chipWarnBg} !important; }
  [data-ogsc] .rm-chip-warn { color:${d.chipWarnFg} !important; border-color:${d.border} !important; }
  [data-ogsb] .rm-notice { background:${d.card} !important; }
  [data-ogsc] .rm-notice { border-color:${d.border} !important; color:${d.muted} !important; }
  [data-ogsc] .rm-notice td { color:${d.muted} !important; }
  [data-ogsb] .rm-cta { background:${t.color.yellow} !important; }
  [data-ogsc] a.rm-cta-link { color:${t.color.ink} !important; }
</style>
${head}
</head>
<body style="margin:0;padding:0;background:${t.color.canvas};">
${body}
</body>
</html>`;
}
