import { afterEach, describe, expect, it } from "vitest";
import { validateOutboundSurrealEndpoint } from "./outbound-surreal-endpoint";

describe("validateOutboundSurrealEndpoint", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL_ENV;
  const origAllowPrivate = process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercel;
    process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT = origAllowPrivate;
  });

  it("allows public HTTPS in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("https://instance.surreal.cloud")).toEqual({ ok: true });
  });

  it("allows public WSS in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("wss://instance.surreal.cloud")).toEqual({ ok: true });
  });

  it("rejects HTTP in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("http://instance.surreal.cloud").ok).toBe(false);
  });

  it("rejects WS (insecure) in production", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("ws://instance.surreal.cloud").ok).toBe(false);
  });

  it("allows http://localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("http://localhost:8000")).toEqual({ ok: true });
  });

  it("allows ws://localhost in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("ws://localhost:8000")).toEqual({ ok: true });
  });

  it("rejects ws:// to a remote host in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("ws://example.com:8000").ok).toBe(false);
  });

  it("allows remote wss in development", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("wss://example.com:8000")).toEqual({ ok: true });
  });

  it("blocks metadata hostnames", () => {
    process.env.NODE_ENV = "production";
    expect(validateOutboundSurrealEndpoint("https://metadata.google.internal").ok).toBe(false);
  });

  it("blocks private IPv4 unless explicitly allowed (wss too)", () => {
    process.env.NODE_ENV = "development";
    delete process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT;
    expect(validateOutboundSurrealEndpoint("wss://10.0.0.5").ok).toBe(false);
  });

  it("rejects an unsupported scheme", () => {
    process.env.NODE_ENV = "development";
    expect(validateOutboundSurrealEndpoint("ftp://example.com").ok).toBe(false);
  });
});
