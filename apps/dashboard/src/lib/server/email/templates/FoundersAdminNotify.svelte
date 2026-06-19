<!-- Runes opt-in — see EmailShell.svelte. Project default is runes:false; this template
     uses $props(), which mis-lowers (ReferenceError: props is not defined) without this. -->
<svelte:options runes={true} />

<script lang="ts">
  /**
   * Internal ops email: a new Founders Circle request needs review.
   * Sent to the service-owner admin address(es) on apply. Carries the applicant's name +
   * email (the recipient is the operator, who is authorised to see it) and a link to the
   * admin review screen. Transactional/ops stream — no unsubscribe.
   */
  import { emailTheme as t } from "../theme";
  import EmailShell from "./EmailShell.svelte";

  let {
    applicantName = "",
    applicantEmail,
    reviewUrl,
  }: {
    applicantName?: string;
    applicantEmail: string;
    /** Absolute URL to the admin founders review screen. */
    reviewUrl: string;
  } = $props();
</script>

<EmailShell
  title="A Founders Circle request needs review"
  preheader="A new Founders Circle application is waiting for approval in the admin console."
>
  <!-- Action-needed chip (warning token) -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
    <tbody>
      <tr>
        <td
          class="rm-chip-warn"
          style="background:{t.color.warnBg};border:{t.border};padding:5px 10px;font-family:{t.font
            .mono};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{t.color.warnFg};"
        >
          ⚠ Review needed
        </td>
      </tr>
    </tbody>
  </table>

  <h1
    class="rm-h1"
    style="margin:0 0 18px 0;font-family:{t.font
      .display};font-size:32px;line-height:1.08;font-weight:800;letter-spacing:0.01em;color:{t.color
      .ink};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
  >
    New Founders Circle request
  </h1>

  <p style="margin:0 0 14px 0;">
    A new application to the Restormel Keys Founders Circle is waiting for approval.
  </p>

  <!-- Applicant detail block -->
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    class="rm-notice"
    style="margin:0 0 8px 0;border:{t.border};background:{t.color.canvasDeep};"
  >
    <tbody>
      <tr>
        <td style="padding:14px 16px;font-family:{t.font.mono};font-size:13px;line-height:1.7;color:{t.color.ink};">
          <strong style="font-family:{t.font.mono};">Name:</strong> {applicantName || "—"}<br />
          <strong style="font-family:{t.font.mono};">Email:</strong> {applicantEmail}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Bulletproof brutalist CTA button -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px 0;">
    <tbody>
      <tr>
        <td class="rm-cta" style="background:{t.color.yellow};border:{t.border};box-shadow:3px 3px 0 {t.color.ink};">
          <a
            href={reviewUrl}
            class="rm-cta-link"
            style="display:inline-block;padding:15px 28px;font-family:{t.font
              .mono};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:{t
              .color.ink};text-decoration:none;white-space:nowrap;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;"
          >
            Review in admin →
          </a>
        </td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 6px 0;font-size:13px;color:{t.color.inkMuted};">
    If the button doesn't work, paste this link into your browser:
  </p>
  <p style="margin:0 0 20px 0;font-family:{t.font.mono};font-size:12px;word-break:break-all;">
    <a href={reviewUrl} class="rm-link" style="color:{t.color.blue};">{reviewUrl}</a>
  </p>

  <p style="margin:0;color:{t.color.inkMuted};font-size:13px;">
    — Restormel Keys
  </p>
</EmailShell>
