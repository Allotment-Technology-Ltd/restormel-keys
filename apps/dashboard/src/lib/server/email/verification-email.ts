/**
 * Email-address verification — HTML transactional email (REC-PLAN-017 Phase 2).
 * Sent by the Better Auth `emailVerification.sendVerificationEmail` hook on the
 * `AUTH_PROVIDER === "self"` path.
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free
 * of Svelte/template imports (and their pure unit tests stay light).
 * Pattern mirrors founders-approved-email.ts exactly.
 */
import { buildMailEnvelope, sendMail, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import VerificationEmail from "./templates/VerificationEmail.svelte";

export type VerificationEmailArgs = {
  to: string;
  verifyUrl: string;
};

export const VERIFICATION_EMAIL_SUBJECT = "Verify your Restormel Keys email";

/** Plain-text alternative — pure, so the copy can be unit-tested without Svelte. */
export function verificationEmailText(verifyUrl: string): string {
  return [
    "Verify your Restormel Keys email",
    "",
    "You're one step away. Use the link below to verify your email address and complete",
    "sign-in to Restormel Keys:",
    "",
    verifyUrl,
    "",
    "If you didn't request this, you can safely ignore this message. Your account won't",
    "be affected.",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildVerificationEmail(args: VerificationEmailArgs): MailEnvelope {
  const html = renderEmailDocument(VerificationEmail, { verifyUrl: args.verifyUrl });
  return buildMailEnvelope({
    to: args.to,
    subject: VERIFICATION_EMAIL_SUBJECT,
    text: verificationEmailText(args.verifyUrl),
    html,
    category: "transactional",
  });
}

/** Render + send the verification email via the transactional mailbox. */
export async function sendVerificationEmail(args: VerificationEmailArgs): Promise<void> {
  await sendMail(buildVerificationEmail(args));
}
