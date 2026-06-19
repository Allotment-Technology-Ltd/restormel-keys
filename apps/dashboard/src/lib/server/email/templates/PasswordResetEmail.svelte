<script lang="ts">
  /**
   * Transactional email: password reset request.
   * Sent when a user requests a password reset link.
   * Transactional stream — no unsubscribe block.
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    resetUrl,
  }: {
    resetUrl: string;
  } = $props();
</script>

<EmailShell
  title="Reset your Restormel Keys password"
  preheader="We received a request to reset your Restormel Keys password. Use the link below — it expires in 1 hour."
>
  <h1
    class="rm-h1"
    style="margin:0 0 16px 0;font-family:{t.font
      .display};font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    Reset your password.
  </h1>

  <p style="margin:0 0 14px 0;">
    We received a request to reset the password for your Restormel Keys account.
    Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
  </p>

  <!-- Bulletproof brutalist CTA button -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tbody>
      <tr>
        <td
          class="rm-cta"
          style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};"
        >
          <a
            href={resetUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:14px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;min-height:44px;line-height:1.2;"
          >
            Reset password →
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 6px 0;font-size:13px;color:{t.color.inkMuted};">
    If the button doesn't work, paste this link into your browser:
  </p>
  <p style="margin:0 0 20px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
    <a href={resetUrl} class="rm-link" style="color:{t.color.blue};">{resetUrl}</a>
  </p>

  <!-- Reassurance notice -->
  <table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0 0 20px 0;width:100%;"
  >
    <tbody>
      <tr>
        <td
          style="background:{t.color.canvasDeep};border:{t.border};padding:12px 16px;font-family:{t
            .font.body};font-size:14px;line-height:1.5;color:{t.color.inkMuted};"
        >
          If you didn't request this, your password won't change. You can ignore this email safely.
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    The Restormel team
  </p>
</EmailShell>
