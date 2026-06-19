<!--
  RUNES OPT-IN (load-bearing): the dashboard sets `compilerOptions.runes: false`
  (svelte.config.js). This template is authored with runes (`$props()`, snippets).
  Under the project default, `$props` mis-lowers to a store read of an undefined
  `props` identifier → `ReferenceError: props is not defined` at SSR render time —
  which silently broke EVERY transactional email in production (REC-INC: founders
  approval no-send). `<svelte:options runes={true} />` opts this component into runes
  mode regardless of the project default. DO NOT REMOVE without reverting to legacy
  `export let` (see SocialProof.svelte / changelog/+page.svelte for that pattern).
-->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Neo-brutalist email frame: warm cream canvas, ink-bordered surface card with an offset
   * hard shadow, mono wordmark header, and a footer that carries the legal entity + an
   * optional `footnote` snippet (used by MARKETING emails for the unsubscribe block —
   * transactional emails leave it empty).
   *
   * Email-client rules followed here: table layout, inline styles only (no scoped <style>,
   * no CSS variables), literal colours from `emailTheme`, max-width 600px single column.
   * Rows are wrapped in <tbody> (required by the Svelte compiler; harmless in mail clients).
   */
  import type { Snippet } from "svelte";
  import { emailTheme as t } from "../theme";

  let {
    title,
    preheader = "",
    children,
    footnote,
  }: {
    title: string;
    preheader?: string;
    children: Snippet;
    footnote?: Snippet;
  } = $props();

  // Inbox preview line: explicit preheader, else fall back to the subject/title.
  const preview = preheader || title;
</script>

<!-- Hidden preview text (preheader) -->
<div
  style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;"
>{preview}</div>

<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  class="rm-canvas"
  style="background:{t.color.canvas};margin:0;padding:0;width:100%;"
>
  <tbody>
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Card -->
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="rm-fluid rm-card"
          style="max-width:{t.maxWidth};width:100%;background:{t.color.surface};border:{t.border};box-shadow:{t.shadow};"
        >
          <tbody>
            <tr>
              <td class="rm-header" style="padding:22px 28px;border-bottom:{t.border};">
                <span
                  class="rm-wordmark"
                  style="font-family:{t.font
                    .mono};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;color:{t
                    .color.ink};">Restormel <span class="rm-accent" style="color:{t.color.blue};">Keys</span></span
                >
              </td>
            </tr>
            <tr>
              <td
                class="rm-body"
                style="padding:28px;font-family:{t.font
                  .body};font-size:16px;line-height:1.6;color:{t.color
                  .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
              >
                {@render children()}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Footer (outside the card) -->
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="rm-fluid"
          style="max-width:{t.maxWidth};width:100%;"
        >
          <tbody>
            <tr>
              <td
                class="rm-footer"
                style="padding:18px 10px;font-family:{t.font.mono};font-size:10px;line-height:1.7;letter-spacing:0.04em;color:{t
                  .color.inkFaint};text-align:center;"
              >
                Allotment Technology Ltd · Company no. 16925574 · United Kingdom<br />
                {#if footnote}{@render footnote()}{/if}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
