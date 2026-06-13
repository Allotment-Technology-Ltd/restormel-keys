/**
 * P4 — Transactional email for the SELF-HOSTED auth path (Better Auth hooks).
 *
 * SCOPE / SAFETY: only used on the `AUTH_PROVIDER === "self"` path (Better Auth's
 * email-verification / password-reset hooks call into here). The `neon` path does
 * not send mail from the dashboard, so this is dormant under the default.
 *
 * Transport: SMTP over implicit TLS (port 465, `secure: true`). Configure via
 * `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`.
 *
 * Mailbox mapping (owner decision — keep stable):
 *   - transactional (verification, password reset): From = notify@, Reply-To = contact@
 *   - security / ops alerts:                         From = admin@,  Reply-To = admin@
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "$env/dynamic/private";

/** Default mailbox identities. Overridable via env for staging. */
export const DEFAULT_EMAIL_FROM = "Restormel Keys <notify@restormel.dev>";
export const DEFAULT_EMAIL_REPLY_TO = "contact@restormel.dev";
/** Security / ops alerts always originate from and reply to admin@. */
export const SECURITY_EMAIL_ADDRESS = "admin@restormel.dev";

export type MailEnvelope = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from: string;
  replyTo: string;
};

export type MailCategory = "transactional" | "security";

/**
 * Resolve the From/Reply-To pair for a message category. Transactional mail uses
 * the `EMAIL_FROM` / `EMAIL_REPLY_TO` env (defaulting to notify@ / contact@);
 * security/ops mail is pinned to admin@ for both From and Reply-To so alerts are
 * unambiguous and replies reach the operator inbox.
 *
 * Pure + dependency-free so it can be unit-tested without a transport.
 */
export function resolveMailIdentity(category: MailCategory): {
  from: string;
  replyTo: string;
} {
  if (category === "security") {
    return { from: SECURITY_EMAIL_ADDRESS, replyTo: SECURITY_EMAIL_ADDRESS };
  }
  return {
    from: (env.EMAIL_FROM ?? "").trim() || DEFAULT_EMAIL_FROM,
    replyTo: (env.EMAIL_REPLY_TO ?? "").trim() || DEFAULT_EMAIL_REPLY_TO,
  };
}

/**
 * Build the full envelope for a message of the given category. Separated from the
 * transport so tests can assert the From/Reply-To mapping without sending.
 */
export function buildMailEnvelope(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  category: MailCategory;
}): MailEnvelope {
  const { from, replyTo } = resolveMailIdentity(args.category);
  return {
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    from,
    replyTo,
  };
}

let _transport: Transporter | null = null;

/** Process-singleton SMTP transport (implicit TLS on 465 by default). */
export function getTransport(): Transporter {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 465,
    secure: true, // 465 = implicit TLS
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });
  return _transport;
}

/** Send a fully-formed envelope through the SMTP transport. */
export async function sendMail(envelope: MailEnvelope): Promise<void> {
  await getTransport().sendMail({
    to: envelope.to,
    from: envelope.from,
    replyTo: envelope.replyTo,
    subject: envelope.subject,
    text: envelope.text,
    html: envelope.html,
  });
}

/** Better Auth `sendVerificationEmail` hook → transactional mailbox. */
export async function sendVerificationEmail(args: {
  to: string;
  verifyUrl: string;
}): Promise<void> {
  const envelope = buildMailEnvelope({
    to: args.to,
    subject: "Verify your Restormel Keys email",
    text: `Confirm your email to finish signing in to Restormel Keys:\n\n${args.verifyUrl}\n\nIf you didn't request this, you can ignore this message.`,
    category: "transactional",
  });
  await sendMail(envelope);
}

/** Better Auth `sendResetPassword` hook → transactional mailbox. */
export async function sendPasswordResetEmail(args: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const envelope = buildMailEnvelope({
    to: args.to,
    subject: "Reset your Restormel Keys password",
    text: `Reset your Restormel Keys password using the link below:\n\n${args.resetUrl}\n\nIf you didn't request this, you can ignore this message — your password will not change.`,
    category: "transactional",
  });
  await sendMail(envelope);
}

/** Security / ops alert → admin@ mailbox (From + Reply-To). */
export async function sendSecurityAlertEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const envelope = buildMailEnvelope({
    to: args.to,
    subject: args.subject,
    text: args.body,
    category: "security",
  });
  await sendMail(envelope);
}
