import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P4 — the mailbox mapping must be exact:
//   transactional (verification, reset): From=notify@ / Reply-To=contact@
//   security/ops alerts: From=notify@send. (send.-owned, Migadu 553 fix) / Reply-To=admin@
//
// Background: Migadu enforces sender ownership — the SMTP user (notify@send.restormel.dev)
// cannot send as admin@restormel.dev (cross-domain → 553 5.7.1). The security From must
// therefore be a send.-owned address; Reply-To is used to route replies to admin@.
//
// We assert the envelope builder (pure) and that the verification/security hooks produce
// correct envelopes, with the SMTP transport stubbed so nothing is sent.

const sendMailSpy = vi.fn(async (_opts: { from: string; replyTo: string; to: string; subject: string; text: string }) => {});
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailSpy })) },
  createTransport: vi.fn(() => ({ sendMail: sendMailSpy })),
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    SMTP_HOST: "smtp.test",
    SMTP_PORT: "465",
    SMTP_USER: "u",
    SMTP_PASSWORD: "p",
    // EMAIL_FROM / EMAIL_REPLY_TO / SECURITY_EMAIL_FROM / SECURITY_EMAIL_REPLY_TO
    // intentionally unset → defaults apply.
  },
}));

describe("send-mail mailbox mapping (P4)", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMailSpy.mockClear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("transactional category → From=notify@, Reply-To=contact@", async () => {
    const { resolveMailIdentity } = await import("./send-mail");
    expect(resolveMailIdentity("transactional")).toEqual({
      from: "Restormel Keys <notify@restormel.dev>",
      replyTo: "contact@restormel.dev",
    });
  });

  it("security category → From is send.-owned (Restormel Security label), Reply-To=admin@", async () => {
    // The From must be the transactional mailbox (send.-owned) to satisfy Migadu's 553
    // sender-ownership check; the display name is swapped to "Restormel Security".
    // Reply-To routes operator replies to admin@ without sender ownership.
    const { resolveMailIdentity } = await import("./send-mail");
    const id = resolveMailIdentity("security");
    expect(id.from).toBe("Restormel Security <notify@restormel.dev>");
    expect(id.replyTo).toBe("admin@restormel.dev");
    // From must NOT be admin@restormel.dev — that domain is not owned by the SMTP user
    expect(id.from).not.toContain("admin@restormel.dev");
  });

  it("buildMailEnvelope stamps the transactional identity onto the message", async () => {
    const { buildMailEnvelope } = await import("./send-mail");
    const env = buildMailEnvelope({
      to: "user@example.com",
      subject: "hi",
      text: "body",
      category: "transactional",
    });
    expect(env.from).toBe("Restormel Keys <notify@restormel.dev>");
    expect(env.replyTo).toBe("contact@restormel.dev");
    expect(env.to).toBe("user@example.com");
  });

  it("verification email hook sends a transactional message (notify@ / contact@)", async () => {
    const { sendVerificationEmail } = await import("./send-mail");
    await sendVerificationEmail({ to: "user@example.com", verifyUrl: "https://restormel.dev/verify?token=x" });
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const arg = sendMailSpy.mock.calls[0][0];
    expect(arg.from).toBe("Restormel Keys <notify@restormel.dev>");
    expect(arg.replyTo).toBe("contact@restormel.dev");
    expect(arg.to).toBe("user@example.com");
    expect(arg.text).toContain("https://restormel.dev/verify?token=x");
  });

  it("security-alert email sends From a send.-owned address with Reply-To=admin@", async () => {
    const { sendSecurityAlertEmail } = await import("./send-mail");
    await sendSecurityAlertEmail({ to: "admin@restormel.dev", subject: "alert", body: "something happened" });
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const arg = sendMailSpy.mock.calls[0][0];
    // From must be owned by the SMTP user (send.restormel.dev domain or EMAIL_FROM mailbox)
    expect(arg.from).toBe("Restormel Security <notify@restormel.dev>");
    expect(arg.from).not.toContain("admin@restormel.dev");
    // Reply-To routes replies to the admin inbox
    expect(arg.replyTo).toBe("admin@restormel.dev");
  });

  it("SECURITY_EMAIL_FROM env overrides the default security From", async () => {
    vi.resetModules();
    vi.doMock("$env/dynamic/private", () => ({
      env: {
        SMTP_HOST: "smtp.test",
        SECURITY_EMAIL_FROM: "Restormel Security <notify@send.restormel.dev>",
      },
    }));
    const { resolveMailIdentity } = await import("./send-mail");
    const id = resolveMailIdentity("security");
    expect(id.from).toBe("Restormel Security <notify@send.restormel.dev>");
    expect(id.replyTo).toBe("admin@restormel.dev");
  });

  it("SECURITY_EMAIL_REPLY_TO env overrides the default security Reply-To", async () => {
    vi.resetModules();
    vi.doMock("$env/dynamic/private", () => ({
      env: {
        SMTP_HOST: "smtp.test",
        SECURITY_EMAIL_REPLY_TO: "ops@restormel.dev",
      },
    }));
    const { resolveMailIdentity } = await import("./send-mail");
    const id = resolveMailIdentity("security");
    expect(id.replyTo).toBe("ops@restormel.dev");
  });

  it("EMAIL_FROM / EMAIL_REPLY_TO env override the transactional defaults", async () => {
    vi.resetModules();
    vi.doMock("$env/dynamic/private", () => ({
      env: {
        SMTP_HOST: "smtp.test",
        EMAIL_FROM: "Staging <notify@staging.restormel.dev>",
        EMAIL_REPLY_TO: "contact@staging.restormel.dev",
      },
    }));
    const { resolveMailIdentity } = await import("./send-mail");
    expect(resolveMailIdentity("transactional")).toEqual({
      from: "Staging <notify@staging.restormel.dev>",
      replyTo: "contact@staging.restormel.dev",
    });
  });

  it("security From inherits the EMAIL_FROM mailbox when SECURITY_EMAIL_FROM is unset", async () => {
    // If EMAIL_FROM is customised (e.g. staging), the security From should derive from that
    // mailbox so it stays send.-owned, just with the "Restormel Security" display name.
    vi.resetModules();
    vi.doMock("$env/dynamic/private", () => ({
      env: {
        SMTP_HOST: "smtp.test",
        EMAIL_FROM: "Staging Keys <notify@send.staging.restormel.dev>",
      },
    }));
    const { resolveMailIdentity } = await import("./send-mail");
    const id = resolveMailIdentity("security");
    expect(id.from).toBe("Restormel Security <notify@send.staging.restormel.dev>");
    expect(id.replyTo).toBe("admin@restormel.dev");
  });
});
