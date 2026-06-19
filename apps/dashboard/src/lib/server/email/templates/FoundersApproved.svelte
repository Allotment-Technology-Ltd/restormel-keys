<script lang="ts">
  /**
   * Transactional email: a Founders Circle application has been APPROVED.
   * Sent from the approval handler when an operator flips status → approved.
   * Transactional stream (no unsubscribe — account/access-grant notice).
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    name = "",
    dashboardUrl,
  }: {
    name?: string;
    dashboardUrl: string;
  } = $props();

  const greeting = name ? `Hi ${name},` : "Hi,";
</script>

<EmailShell
  title="You're in — Founders Circle access approved"
  preheader="Your Restormel Keys Founders Circle access is approved. Open your dashboard to get started."
>
  <!-- Status chip -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
    <tbody>
      <tr>
        <td
          class="rm-chip"
          style="background:{t.color.okBg};border:{t.border};padding:5px 10px;font-family:{t.font
            .mono};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{t
            .color.okFg};"
        >
          ✓ Access approved
        </td>
      </tr>
    </tbody>
  </table>

  <h1
    class="rm-h1"
    style="margin:0 0 16px 0;font-family:{t.font
      .display};font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    You're in.
  </h1>

  <p style="margin:0 0 14px 0;">{greeting}</p>

  <p style="margin:0 0 14px 0;">
    Your application to the <strong>Restormel Keys Founders Circle</strong> has been approved — welcome.
    Your account now has full access: create gateway keys, build multi-step routes, and run the Connect
    ingest &amp; verify pipelines.
  </p>

  <!-- Bulletproof brutalist CTA button -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tbody>
      <tr>
        <td class="rm-cta" style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};">
          <a
            href={dashboardUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:15px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;white-space:nowrap;"
          >
            Open your dashboard →
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 6px 0;font-size:13px;color:{t.color.inkMuted};">
    If the button doesn't work, paste this link into your browser:
  </p>
  <p style="margin:0 0 20px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
    <a href={dashboardUrl} class="rm-link" style="color:{t.color.blue};">{dashboardUrl}</a>
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    Welcome aboard,<br />The Restormel team
  </p>
</EmailShell>
