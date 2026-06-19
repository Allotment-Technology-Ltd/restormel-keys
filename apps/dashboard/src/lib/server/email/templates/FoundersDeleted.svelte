<!-- Runes opt-in — see EmailShell.svelte. Project default is runes:false; this template
     uses $props(), which mis-lowers (ReferenceError: props is not defined) without this. -->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Transactional email: a Founders Circle request has been REMOVED from the system.
   * Sent ONLY when an operator opts in while deleting (default delete is silent).
   * Neutral / administrative, GDPR-friendly, no dashboard CTA. Transactional stream
   * (no unsubscribe — direct administrative notice about the person's record).
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    name = "",
  }: {
    name?: string;
  } = $props();

  const greeting = name ? `Hi ${name},` : "Hi,";
</script>

<EmailShell
  title="Your Founders Circle request has been removed"
  preheader="Your Restormel Keys Founders Circle request and its details have been removed from our system."
>
  <!-- Neutral status chip (NOT the green ok chip): muted amber warn token, AA contrast -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
    <tbody>
      <tr>
        <td
          class="rm-chip-warn"
          style="background:{t.color.warnBg};border:{t.border};padding:5px 10px;font-family:{t.font
            .mono};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{t
            .color.warnFg};"
        >
          Request removed
        </td>
      </tr>
    </tbody>
  </table>

  <h1
    class="rm-h1"
    style="margin:0 0 16px 0;font-family:{t.font
      .display};font-size:34px;line-height:1.07;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    Your request has been removed.
  </h1>

  <p style="margin:0 0 14px 0;">{greeting}</p>

  <p style="margin:0 0 14px 0;">
    We're writing to let you know that your <strong>Restormel Keys Founders Circle</strong> request,
    and the details associated with it, have been removed from our system.
  </p>

  <p style="margin:0 0 14px 0;">
    If this was a mistake, or you'd like to apply again, just reply to this email or contact us at
    <a href="mailto:contact@restormel.dev" class="rm-link" style="color:{t.color.blue};"
      >contact@restormel.dev</a
    > and we'll be glad to help.
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    The Restormel team
  </p>
</EmailShell>
