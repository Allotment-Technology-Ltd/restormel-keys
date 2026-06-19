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
 *   - transactional (verification, password reset): From = notify@send., Reply-To = contact@
 *   - security / ops alerts:                         From = notify@send. (SECURITY_EMAIL_FROM),
 *                                                    Reply-To = admin@ (SECURITY_EMAIL_REPLY_TO)
 *
 * Background: Migadu enforces sender ownership — From must be a mailbox owned by the
 * authenticated SMTP user (notify@send.restormel.dev). Pinning From=admin@restormel.dev
 * causes a 553 5.7.1 rejection. Reply-To requires no sender ownership, so admin@ can
 * still receive all replies.
 *
 * Env overrides (all optional — production Coolify env sets SECURITY_EMAIL_FROM):
 *   SECURITY_EMAIL_FROM     — From for security/ops alerts (default: "Restormel Security <{EMAIL_FROM mailbox}>")
 *   SECURITY_EMAIL_REPLY_TO — Reply-To for security/ops alerts (default: admin@restormel.dev)
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "$env/dynamic/private";

/** Default mailbox identities. Overridable via env for staging. */
export const DEFAULT_EMAIL_FROM = "Restormel Keys <notify@restormel.dev>";
export const DEFAULT_EMAIL_REPLY_TO = "contact@restormel.dev";
/**
 * Default Reply-To for security/ops alerts. Replies still reach the admin inbox even
 * though the From address is the send.-owned mailbox.
 */
export const DEFAULT_SECURITY_REPLY_TO = "admin@restormel.dev";

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
 * the `EMAIL_FROM` / `EMAIL_REPLY_TO` env (defaulting to notify@ / contact@).
 *
 * Security/ops mail uses:
 *   From    = SECURITY_EMAIL_FROM env  (default: "Restormel Security <{transactional mailbox}>")
 *             — MUST be a mailbox owned by the SMTP user (Migadu 553 enforcement).
 *   Reply-To = SECURITY_EMAIL_REPLY_TO env (default: admin@restormel.dev)
 *             — no sender ownership required; replies reach the admin inbox.
 *
 * Pure + dependency-free so it can be unit-tested without a transport.
 */
export function resolveMailIdentity(category: MailCategory): {
  from: string;
  replyTo: string;
} {
  const transactionalFrom = (env.EMAIL_FROM ?? "").trim() || DEFAULT_EMAIL_FROM;
  if (category === "security") {
    // Default From: replace the display name on the transactional mailbox so the
    // sending address stays owned by the SMTP user while the label is distinct.
    const defaultSecurityFrom = transactionalFrom.replace(
      /^[^<]*</,
      "Restormel Security <",
    );
    return {
      from: (env.SECURITY_EMAIL_FROM ?? "").trim() || defaultSecurityFrom,
      replyTo:
        (env.SECURITY_EMAIL_REPLY_TO ?? "").trim() || DEFAULT_SECURITY_REPLY_TO,
    };
  }
  return {
    from: transactionalFrom,
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

/**
 * Process-singleton SMTP transport. Port-aware TLS: 465 = implicit TLS,
 * everything else (e.g. Migadu's 587) = STARTTLS. Default port is 587 to match the
 * deployed Coolify env. Accepts `SMTP_PASS` (the deployed var name) or `SMTP_PASSWORD`.
 */
export function getTransport(): Transporter {
  if (_transport) return _transport;
  const port = Number(env.SMTP_PORT) || 587;
  const secure = port === 465; // 465 = implicit TLS; 587/25 = STARTTLS upgrade
  _transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS ?? env.SMTP_PASSWORD,
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

/** Security / ops alert → send.-owned From, Reply-To=admin@restormel.dev. */
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
