<script lang="ts">
  /**
   * Transactional security/ops alert email (sent from admin@).
   * No unsubscribe — this is an operational/security notice.
   * Subject is set by the caller; this template does not hardcode it.
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    heading,
    message,
    actionUrl,
  }: {
    heading: string;
    message: string;
    actionUrl?: string;
  } = $props();
</script>

<EmailShell title={heading} preheader="Action may be required. Review the details below.">
  <!-- Warning status chip — dedicated amber token (distinct from the yellow CTA), WCAG AA -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
    <tbody>
      <tr>
        <td
          class="rm-chip-warn"
          style="background:{t.color.warnBg};border:{t.border};padding:5px 10px;font-family:{t.font
            .mono};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{t.color.warnFg};"
        >
          ⚠ Security alert
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Display headline -->
  <h1
    class="rm-h1"
    style="margin:0 0 20px 0;font-family:{t.font
      .display};font-size:34px;line-height:1.07;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    {heading}
  </h1>

  <!-- Message body -->
  <p
    style="margin:0 0 20px 0;font-family:{t.font.body};font-size:15px;line-height:1.65;color:{t.color.ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    {message}
  </p>

  <!-- Optional CTA: only rendered when actionUrl is provided -->
  {#if actionUrl}
    <!-- Bulletproof brutalist CTA button -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px 0;">
      <tbody>
        <tr>
          <td
            class="rm-cta"
            style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};"
          >
            <a
              href={actionUrl}
              class="rm-cta-link"
              style="display:inline-block;padding:15px 28px;font-family:{t.font
                .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
                .color.ink};text-decoration:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
            >
              Review now →
            </a>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Plain fallback link -->
    <p style="margin:0 0 20px 0;font-size:13px;color:{t.color.inkMuted};">
      If the button does not work, paste this link into your browser:
    </p>
    <p style="margin:0 0 24px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
      <a href={actionUrl} class="rm-link" style="color:{t.color.blue};">{actionUrl}</a>
    </p>
  {/if}

  <!-- Sign-off -->
  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    The Restormel security team
  </p>
</EmailShell>
