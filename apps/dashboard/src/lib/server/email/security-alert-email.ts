/**
 * Security / ops alert — HTML email (REC-PLAN-017 Phase 2).
 * Routed to the "security" category: From = admin@restormel.dev, Reply-To = admin@restormel.dev.
 * No unsubscribe block — this is an operational / security notice.
 *
 * Kept separate from send-mail.ts so the transport + identity primitives stay free
 * of Svelte/template imports (and their pure unit tests stay light).
 * Pattern mirrors founders-approved-email.ts exactly.
 */
import { buildMailEnvelope, sendMail, type MailEnvelope } from "./send-mail";
import { renderEmailDocument } from "./render";
import SecurityAlertEmail from "./templates/SecurityAlertEmail.svelte";

export type SecurityAlertEmailArgs = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionUrl?: string;
};

/** Plain-text alternative — pure, so the copy can be unit-tested without Svelte. */
export function securityAlertEmailText(
  heading: string,
  message: string,
  actionUrl?: string,
): string {
  const lines = [
    `[Security alert] ${heading}`,
    "",
    message,
  ];
  if (actionUrl) {
    lines.push("", "Review now:", actionUrl);
  }
  lines.push(
    "",
    "The Restormel security team",
    "",
    "—",
    "Allotment Technology Ltd · Company no. 16925574 · United Kingdom",
  );
  return lines.join("\n");
}

/** Build the full envelope (no send) — pure, so the mapping + render can be unit-tested. */
export function buildSecurityAlertEmail(args: SecurityAlertEmailArgs): MailEnvelope {
  const html = renderEmailDocument(SecurityAlertEmail, {
    heading: args.heading,
    message: args.message,
    actionUrl: args.actionUrl,
  });
  return buildMailEnvelope({
    to: args.to,
    subject: args.subject,
    text: securityAlertEmailText(args.heading, args.message, args.actionUrl),
    html,
    category: "security",
  });
}

/** Render + send the security alert email via the admin@ mailbox. */
export async function sendSecurityAlertEmail(args: SecurityAlertEmailArgs): Promise<void> {
  await sendMail(buildSecurityAlertEmail(args));
}
