/**
 * AES-256-GCM encryption for hosted provider credentials.
 * Key: RESTORMEL_CREDENTIALS_ENCRYPTION_KEY — 32 bytes, base64-encoded (openssl rand -base64 32).
 *
 * Read via `$env/dynamic/private` so `apps/dashboard/.env.local` is respected in dev;
 * `process.env` alone does not receive Vite-loaded env files reliably.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "$env/dynamic/private";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_BYTES = 32;
const VERSION = 1;

function encryptionKeyBase64(): string {
  return (
    env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY?.trim() ??
    process.env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY?.trim() ??
    ""
  );
}

function getMasterKey(): Buffer | null {
  const b64 = encryptionKeyBase64();
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== KEY_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

export function credentialEncryptionMisconfigReason(): string | null {
  const b64 = encryptionKeyBase64();
  if (!b64) {
    return "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is not set (use apps/dashboard/.env.local in dev)";
  }
  try {
    if (Buffer.from(b64, "base64").length !== KEY_BYTES) {
      return "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is invalid (expect 32-byte base64 from: openssl rand -base64 32)";
    }
  } catch {
    return "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is invalid (expect base64 encoding)";
  }
  return null;
}

export function isCredentialEncryptionConfigured(): boolean {
  return getMasterKey() !== null;
}

export type EncryptedCredentialPayload = {
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
  encryptionVersion: number;
};

/** Last 4 characters for masked display (alphanumeric only in UI). */
export function secretDisplaySuffix(secret: string): string {
  const t = secret.trim();
  if (t.length <= 4) return "****";
  return t.slice(-4);
}

export function encryptProviderSecret(plaintext: string): { ok: true; payload: EncryptedCredentialPayload } | { ok: false; error: string } {
  const key = getMasterKey();
  if (!key) {
    return { ok: false, error: "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is not set or invalid (expect 32-byte base64)" };
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ok: true,
    payload: {
      ciphertextB64: enc.toString("base64"),
      ivB64: iv.toString("base64"),
      authTagB64: tag.toString("base64"),
      encryptionVersion: VERSION,
    },
  };
}

export function decryptProviderSecret(payload: {
  credentialCiphertext: string | null;
  credentialIv: string | null;
  credentialAuthTag: string | null;
  encryptionVersion: number;
}): { ok: true; secret: string } | { ok: false; error: string } {
  const key = getMasterKey();
  if (!key) {
    return { ok: false, error: "decryption not configured" };
  }
  if (!payload.credentialCiphertext || !payload.credentialIv || !payload.credentialAuthTag) {
    return { ok: false, error: "no ciphertext" };
  }
  if (payload.encryptionVersion !== VERSION) {
    return { ok: false, error: "unsupported encryption version" };
  }
  try {
    const iv = Buffer.from(payload.credentialIv, "base64");
    const tag = Buffer.from(payload.credentialAuthTag, "base64");
    const ciphertext = Buffer.from(payload.credentialCiphertext, "base64");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ok: true, secret: dec.toString("utf8") };
  } catch {
    return { ok: false, error: "decrypt failed" };
  }
}
