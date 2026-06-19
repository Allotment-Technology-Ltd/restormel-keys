/**
 * "Founders Circle request recorded" — applicant confirmation, sent on apply.
 * Transactional stream (no unsubscribe — confirms an action the person just took). Carries an
 * honest marketing moment: an invite to explore the LIVE verified-context functionality via the
 * docs (Door-1 — what's shipped, not aspirational).
 *
 * Identity: From = notify@send.restormel.dev (transactional), Reply-To = contact@restormel.dev
 * (the transactional default — replies reach the contact inbox).
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free of any
 * Svelte/template imports (mirrors founders-approved-email.ts).
 */
import { buildMailEnvelope, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import { sendAndRecord } from "./email-send-log";
import FoundersApplyConfirmation from "./templates/FoundersApplyConfirmation.svelte";

export type FoundersApplyConfirmationArgs = {
  to: string;
  /** Applicant display name (optional — falls back to a neutral greeting). */
  name?: string | null;
  /** Absolute URL to the verified-context docs / demo (restormel.dev/keys/docs). */
  docsUrl: string;
};

export const FOUNDERS_APPLY_CONFIRMATION_SUBJECT =
  "Your Restormel Keys Founders Circle request is recorded";

/** Plain-text alternative — pure, so the copy + greeting fallback can be unit-tested. */
export function foundersApplyConfirmationText(
  name: string | null | undefined,
  docsUrl: string,
): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return [
    "You're on the list — your Restormel Keys Founders Circle request is recorded.",
    "",
    greeting,
    "",
    "Thanks for applying to the Restormel Keys Founders Circle — your request is recorded. We " +
      "review applications by hand, so a real human is reading yours. We'll be in touch when your " +
      "access is ready; nothing more is needed from you right now.",
    "",
    "While you wait — the most interesting thing Restormel does is verified context: answers " +
      "carried with the evidence and provenance behind them, not just a confident guess. That part " +
      "is live today. The docs walk it end to end, with a demo you can poke at:",
    docsUrl,
    "",
    "Talk soon,",
    "The Restormel team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildFoundersApplyConfirmationEmail(
  args: FoundersApplyConfirmationArgs,
): MailEnvelope {
  const name = args.name ?? "";
  const html = renderEmailDocument(FoundersApplyConfirmation, {
    name,
    docsUrl: args.docsUrl,
  });
  return buildMailEnvelope({
    to: args.to,
    subject: FOUNDERS_APPLY_CONFIRMATION_SUBJECT,
    text: foundersApplyConfirmationText(args.name, args.docsUrl),
    html,
    category: "transactional",
  });
}

/** Render + send the confirmation via the transactional mailbox, recording the outcome. */
export async function sendFoundersApplyConfirmationEmail(
  args: FoundersApplyConfirmationArgs,
): Promise<void> {
  await sendAndRecord({
    envelope: buildFoundersApplyConfirmationEmail(args),
    category: "founders_apply_confirmation",
    contextKey: args.to,
  });
}
