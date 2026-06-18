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
    style="margin:0 0 14px 0;font-family:{t.font
      .display};font-size:34px;line-height:1.0;font-weight:900;letter-spacing:-0.01em;color:{t
      .color.ink};"
  >
    You're in.
  </h1>

  <p style="margin:0 0 14px 0;">{greeting}</p>

  <p style="margin:0 0 14px 0;">
    Your application to the <strong>Restormel Keys Founders Circle</strong> has been approved. Your
    account now has full access to the dashboard — keys, routing, and the Connect pipelines.
  </p>

  <!-- Bulletproof brutalist CTA button -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tbody>
      <tr>
        <td style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};">
          <a
            href={dashboardUrl}
            style="display:inline-block;padding:13px 24px;font-family:{t.font
              .mono};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;"
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
    <a href={dashboardUrl} style="color:{t.color.blue};">{dashboardUrl}</a>
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    Welcome aboard,<br />The Restormel team
  </p>
</EmailShell>
