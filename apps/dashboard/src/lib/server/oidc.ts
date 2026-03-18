import { createHash, createSign, createVerify, createPublicKey } from "node:crypto";

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
  const pem = process.env.OIDC_PRIVATE_KEY?.trim();
  if (!pem) throw new Error("OIDC_PRIVATE_KEY is not set");
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
  const pem = process.env.OIDC_PUBLIC_KEY?.trim();
  if (!pem) throw new Error("OIDC_PUBLIC_KEY is not set");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${p}`);
  verifier.end();
  const sig = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!verifier.verify(pem, sig)) throw new Error("Invalid signature");
  return { header, payload };
}

export function jwksFromPublicKey(): { keys: any[]; kid: string } {
  const pem = process.env.OIDC_PUBLIC_KEY?.trim();
  if (!pem) throw new Error("OIDC_PUBLIC_KEY is not set");
  const keyObj = createPublicKey(pem);
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

