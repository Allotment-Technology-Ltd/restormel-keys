<!-- Runes opt-in — see EmailShell.svelte. Project default is runes:false; this template
     uses $props(), which mis-lowers (ReferenceError: props is not defined) without this. -->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Transactional email: a Founders Circle application has been RECORDED.
   * Sent immediately on apply (public founders form). Confirms receipt AND carries an
   * honest marketing moment — an invite to explore the live, verified-context functionality
   * via the docs (Door-1: what's actually shipped, not aspirational).
   * Transactional stream (no unsubscribe — it confirms an action the person just took).
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    name = "",
    docsUrl,
  }: {
    name?: string;
    /** Absolute URL to the verified-context docs / demo (restormel.dev/keys/docs). */
    docsUrl: string;
  } = $props();

  const greeting = name ? `Hi ${name},` : "Hi,";
</script>

<EmailShell
  title="Your Founders Circle request is recorded"
  preheader="We've recorded your Restormel Keys Founders Circle request. While you wait, see what verified context looks like — live."
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
          ✓ Request recorded
        </td>
      </tr>
    </tbody>
  </table>

  <h1
    class="rm-h1"
    style="margin:0 0 16px 0;font-family:{t.font
      .display};font-size:36px;line-height:1.06;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    You're on the list.
  </h1>

  <p style="margin:0 0 14px 0;">{greeting}</p>

  <p style="margin:0 0 14px 0;">
    Thanks for applying to the <strong>Restormel Keys Founders Circle</strong> — your request is
    recorded. We review applications by hand, so this is a real human reading yours. We'll be in
    touch when your access is ready; nothing more is needed from you right now.
  </p>

  <!-- Honest marketing moment: explore what's already live (Door-1 verified context). -->
  <p style="margin:18px 0 14px 0;">
    While you wait — the most interesting thing Restormel does is <strong>verified context</strong>:
    answers carried with the evidence and provenance behind them, not just a confident guess. That
    part is <strong>live today</strong>. The docs walk it end to end, with a demo you can poke at.
  </p>

  <!-- Bulletproof brutalist CTA button -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tbody>
      <tr>
        <td class="rm-cta" style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};">
          <a
            href={docsUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:15px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;white-space:nowrap;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
          >
            See verified context →
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 6px 0;font-size:13px;color:{t.color.inkMuted};">
    If the button doesn't work, paste this link into your browser:
  </p>
  <p style="margin:0 0 20px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
    <a href={docsUrl} class="rm-link" style="color:{t.color.blue};">{docsUrl}</a>
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    Talk soon,<br />The Restormel team
  </p>
</EmailShell>
