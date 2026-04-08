/**
 * AES-256-GCM encryption for hosted provider credentials.
 * Key: RESTORMEL_CREDENTIALS_ENCRYPTION_KEY — 32 bytes, base64-encoded (openssl rand -base64 32).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_BYTES = 32;
const VERSION = 1;

function getMasterKey(): Buffer | null {
  const b64 = process.env.RESTORMEL_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== KEY_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
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
