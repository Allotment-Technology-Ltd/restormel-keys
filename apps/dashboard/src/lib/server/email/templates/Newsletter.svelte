<script lang="ts">
  /**
   * MARKETING newsletter template (DRAFT — built now, NOT sent until the marketing stream is
   * live; see restormel-publish-when-live). Marketing stream → carries a one-click unsubscribe +
   * preferences block (RFC 8058 + UK PECR) via EmailShell's `footnote` snippet.
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    headline,
    intro,
    sections = [],
    ctaLabel,
    ctaUrl,
    unsubscribeUrl,
    preferencesUrl,
  }: {
    headline: string;
    intro: string;
    sections?: { title: string; body: string; url?: string }[];
    ctaLabel: string;
    ctaUrl: string;
    unsubscribeUrl: string;
    preferencesUrl: string;
  } = $props();
</script>

<EmailShell title={headline} preheader={intro}>
  {#snippet footnote()}
    <a href={unsubscribeUrl} class="rm-link" style="color:{t.color.blue};">Unsubscribe</a>
    &nbsp;·&nbsp;
    <a href={preferencesUrl} class="rm-link" style="color:{t.color.blue};">Manage email preferences</a><br />
    You're receiving this because you opted in to Restormel Keys product updates.
  {/snippet}

  <h1
    class="rm-h1"
    style="margin:0 0 16px 0;font-family:{t.font
      .display};font-size:34px;line-height:1.07;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    {headline}
  </h1>

  <p style="margin:0 0 22px 0;">{intro}</p>

  {#each sections as s}
    <h2
      class="rm-h2"
      style="margin:0 0 6px 0;font-family:{t.font
        .display};font-size:19px;line-height:1.2;font-weight:700;color:{t.color
        .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
    >
      {s.title}
    </h2>
    <p style="margin:0 0 8px 0;">{s.body}</p>
    {#if s.url}
      <p style="margin:0 0 22px 0;font-family:{t.font.mono};font-size:12px;">
        <a href={s.url} class="rm-link" style="color:{t.color.blue};">Read more →</a>
      </p>
    {:else}
      <div style="height:14px;line-height:14px;">&nbsp;</div>
    {/if}
  {/each}

  <!-- Primary CTA -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px 0;">
    <tbody>
      <tr>
        <td class="rm-cta" style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};">
          <a
            href={ctaUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:15px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;white-space:nowrap;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
          >
            {ctaLabel} →
          </a>
        </td>
      </tr>
    </tbody>
  </table>
</EmailShell>
