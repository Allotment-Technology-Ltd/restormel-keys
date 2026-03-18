import { createHash, createSign, createVerify, createPublicKey } from "node:crypto";

function normalizePemEnv(name: "OIDC_PRIVATE_KEY" | "OIDC_PUBLIC_KEY"): string {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} is not set`);

  // Common deployment pattern: PEM stored with literal "\n" sequences.
  const withNewlines = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  if (withNewlines.includes("-----BEGIN ")) return withNewlines;

  // Another common pattern: base64-encoded PEM stored as a single line.
  // If decoding yields a PEM-looking string, use it.
  try {
    const decoded = Buffer.from(withNewlines, "base64").toString("utf8").trim();
    if (decoded.includes("-----BEGIN ")) return decoded;
  } catch {
    // ignore
  }

  return withNewlines;
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj: unknown): string {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

export function signJwtRs256(payload: Record<string, unknown>, opts: { issuer: string; audience: string; kid: string }): string {
  const header = { alg: "RS256", typ: "JWT", kid: opts.kid };
  const body = { ...payload, iss: opts.issuer, aud: opts.audience };
  const encoded = `${b64urlJson(header)}.${b64urlJson(body)}`;
  const pem = normalizePemEnv("OIDC_PRIVATE_KEY");
  const signer = createSign("RSA-SHA256");
  signer.update(encoded);
  signer.end();
  const sig = signer.sign(pem);
  return `${encoded}.${b64url(sig)}`;
}

export function verifyJwtRs256(token: string): { header: any; payload: any } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const [h, p, s] = parts;
  const header = JSON.parse(Buffer.from(h.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  const pem = normalizePemEnv("OIDC_PUBLIC_KEY");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${p}`);
  verifier.end();
  const sig = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!verifier.verify(pem, sig)) throw new Error("Invalid signature");
  return { header, payload };
}

export function jwksFromPublicKey(): { keys: any[]; kid: string } {
  const pem = normalizePemEnv("OIDC_PUBLIC_KEY");
  let keyObj: ReturnType<typeof createPublicKey>;
  try {
    keyObj = createPublicKey(pem);
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    throw new Error(
      `Unable to parse OIDC_PUBLIC_KEY (expected RSA public key PEM, or base64-encoded PEM). Underlying error: ${msg}`
    );
  }
  const jwk = keyObj.export({ format: "jwk" }) as any;
  const kid = createHash("sha256").update(`${jwk.n}.${jwk.e}`).digest("hex").slice(0, 16);
  return {
    kid,
    keys: [
      {
        kty: "RSA",
        use: "sig",
        alg: "RS256",
        kid,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}

