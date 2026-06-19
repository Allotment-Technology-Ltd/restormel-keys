<!-- Runes opt-in — see EmailShell.svelte. Project default is runes:false; this template
     uses $props(), which mis-lowers (ReferenceError: props is not defined) without this. -->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Transactional email: a Founders Circle application has NOT been approved (at this time).
   * Sent from the review handler when an operator flips status → rejected.
   * Warm + brief, no dashboard CTA. Transactional stream (no unsubscribe — it's a direct
   * reply to an action the person took).
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
  title="An update on your Founders Circle application"
  preheader="We're not able to approve your Restormel Keys Founders Circle access at this time — your details are kept on file."
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
          Application update
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
    An update on your application.
  </h1>

  <p style="margin:0 0 14px 0;">{greeting}</p>

  <p style="margin:0 0 14px 0;">
    Thanks for your interest in the <strong>Restormel Keys Founders Circle</strong>. We're not able
    to approve your access at this time — the Founders Circle is small and we open spots gradually.
  </p>

  <p style="margin:0 0 14px 0;">
    We've kept your details on file. As more places open up you're welcome to join, and we may be in
    touch when there's room. Nothing more is needed from you right now.
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    With thanks,<br />The Restormel team
  </p>
</EmailShell>
