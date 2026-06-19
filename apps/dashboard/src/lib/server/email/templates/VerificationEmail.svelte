<!-- Runes opt-in — see EmailShell.svelte. Project default is runes:false; this template
     uses $props(), which mis-lowers (ReferenceError: props is not defined) without this. -->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Transactional email: email address verification (finish sign-in / confirm account).
   * Sent when a user registers or triggers a verification flow.
   * Transactional stream (no unsubscribe — account security notice).
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    verifyUrl,
  }: {
    verifyUrl: string;
  } = $props();
</script>

<EmailShell
  title="Verify your Restormel Keys email"
  preheader="Tap the button to confirm your address and finish signing in to Restormel Keys."
>
  <h1
    class="rm-h1"
    style="margin:0 0 20px 0;font-family:{t.font
      .display};font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    Confirm your address.
  </h1>

  <p style="margin:0 0 20px 0;">
    You're one step away. Tap the button below to verify your email address and complete sign-in
    to Restormel Keys.
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
            href={verifyUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:15px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;white-space:nowrap;"
          >
            Verify email →
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 6px 0;font-size:13px;color:{t.color.inkMuted};">
    If the button doesn't work, paste this link into your browser:
  </p>
  <p style="margin:0 0 24px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
    <a href={verifyUrl} class="rm-link" style="color:{t.color.blue};">{verifyUrl}</a>
  </p>

  <p style="margin:0;font-size:13px;color:{t.color.inkMuted};">
    If you didn't request this, you can safely ignore this message. Your account won't be affected.
  </p>
</EmailShell>
