/**
 * Password-reset request — HTML transactional email (REC-PLAN-017 Phase 2).
 * Sent by the Better Auth `emailAndPassword.sendResetPassword` hook on the
 * `AUTH_PROVIDER === "self"` path.
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free
 * of Svelte/template imports (and their pure unit tests stay light).
 * Pattern mirrors founders-approved-email.ts exactly.
 */
import { buildMailEnvelope, sendMail, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import PasswordResetEmail from "./templates/PasswordResetEmail.svelte";

export type PasswordResetEmailArgs = {
  to: string;
  resetUrl: string;
};

export const PASSWORD_RESET_EMAIL_SUBJECT = "Reset your Restormel Keys password";

/** Plain-text alternative — pure, so the copy can be unit-tested without Svelte. */
export function passwordResetEmailText(resetUrl: string): string {
  return [
    "Reset your Restormel Keys password",
    "",
    "We received a request to reset the password for your Restormel Keys account.",
    "Click the link below to choose a new password. This link expires in 1 hour.",
    "",
    resetUrl,
    "",
    "If you didn't request this, your password won't change. You can ignore this email",
    "safely.",
    "",
    "The Restormel team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  ].join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildPasswordResetEmail(args: PasswordResetEmailArgs): MailEnvelope {
  const html = renderEmailDocument(PasswordResetEmail, { resetUrl: args.resetUrl });
  return buildMailEnvelope({
    to: args.to,
    subject: PASSWORD_RESET_EMAIL_SUBJECT,
    text: passwordResetEmailText(args.resetUrl),
    html,
    category: "transactional",
  });
}

/** Render + send the password-reset email via the transactional mailbox. */
export async function sendPasswordResetEmail(args: PasswordResetEmailArgs): Promise<void> {
  await sendMail(buildPasswordResetEmail(args));
}
