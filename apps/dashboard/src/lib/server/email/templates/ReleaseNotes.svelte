<script lang="ts">
  /**
   * MARKETING release-notes template (DRAFT — built now, NOT sent until the marketing stream is
   * live; see restormel-publish-when-live). Carries the one-click unsubscribe + preferences block
   * via EmailShell's `footnote` snippet (RFC 8058 + UK PECR).
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    version,
    date,
    items = [],
    ctaUrl,
    unsubscribeUrl,
    preferencesUrl,
  }: {
    version: string;
    date: string;
    items?: { title: string; body: string }[];
    ctaUrl: string;
    unsubscribeUrl: string;
    preferencesUrl: string;
  } = $props();
</script>

<EmailShell
  title={`Restormel Keys ${version} — what's new`}
  preheader={`What's new in Restormel Keys ${version}.`}
>
  {#snippet footnote()}
    <a href={unsubscribeUrl} class="rm-link" style="color:{t.color.blue};">Unsubscribe</a>
    &nbsp;·&nbsp;
    <a href={preferencesUrl} class="rm-link" style="color:{t.color.blue};">Manage email preferences</a><br />
    You're receiving this because you opted in to Restormel Keys release notes.
  {/snippet}

  <!-- Version / date chip (mono, on-brand) -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
    <tbody>
      <tr>
        <td
          class="rm-chip"
          style="background:{t.color.okBg};border:{t.border};padding:5px 10px;font-family:{t.font
            .mono};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{t.color.okFg};"
        >
          {version} · {date}
        </td>
      </tr>
    </tbody>
  </table>

  <h1
    class="rm-h1"
    style="margin:0 0 18px 0;font-family:{t.font
      .display};font-size:34px;line-height:1.07;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    What's new
  </h1>

  {#each items as item}
    <h2
      class="rm-h2"
      style="margin:0 0 6px 0;font-family:{t.font
        .display};font-size:18px;line-height:1.2;font-weight:700;color:{t.color
        .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
    >
      {item.title}
    </h2>
    <p style="margin:0 0 18px 0;">{item.body}</p>
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
            See it in your dashboard →
          </a>
        </td>
      </tr>
    </tbody>
  </table>
</EmailShell>
