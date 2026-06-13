import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P4 — the mailbox mapping must be exact: transactional mail (verification, reset)
// goes From=notify@ / Reply-To=contact@; security/ops mail goes From+Reply-To=admin@.
// We assert the envelope builder (pure) and that the verification hook produces a
// transactional envelope, with the SMTP transport stubbed so nothing is sent.

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
    // EMAIL_FROM / EMAIL_REPLY_TO intentionally unset → defaults apply.
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

  it("security category → From=admin@, Reply-To=admin@", async () => {
    const { resolveMailIdentity } = await import("./send-mail");
    expect(resolveMailIdentity("security")).toEqual({
      from: "admin@restormel.dev",
      replyTo: "admin@restormel.dev",
    });
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

  it("security-alert email sends from admin@ (From + Reply-To)", async () => {
    const { sendSecurityAlertEmail } = await import("./send-mail");
    await sendSecurityAlertEmail({ to: "admin@restormel.dev", subject: "alert", body: "something happened" });
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const arg = sendMailSpy.mock.calls[0][0];
    expect(arg.from).toBe("admin@restormel.dev");
    expect(arg.replyTo).toBe("admin@restormel.dev");
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
});
