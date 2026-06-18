/**
 * Render a Svelte email template to a complete, email-client-safe HTML document.
 *
 * Templates are authored as `.svelte` components with INLINE styles (see theme.ts for why).
 * `render()` from `svelte/server` returns the body markup; this wraps it in the document
 * boilerplate: charset/viewport/colour-scheme meta, and a `<style>` carrying the brand
 * web-font `@import` (progressive enhancement — most clients ignore it and fall back to the
 * inline web-safe stacks) plus a small responsive rule. No layout depends on this `<style>`.
 */
import { render } from "svelte/server";
import type { Component } from "svelte";
import { emailTheme as t } from "./theme";

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
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Restormel Keys</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap");
  body { margin:0 !important; padding:0 !important; background:${t.color.canvas}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  @media only screen and (max-width:620px) {
    .rm-fluid { width:100% !important; max-width:100% !important; }
  }
</style>
${head}
</head>
<body style="margin:0;padding:0;background:${t.color.canvas};">
${body}
</body>
</html>`;
}
