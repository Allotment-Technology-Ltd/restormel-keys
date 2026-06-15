/**
 * Hermetic test fixtures for the verifying-proxy auth scaffold.
 *
 * Everything here is in-process: tokens are signed with a locally generated key
 * pair and verified against that same key — there is NO remote JWKS fetch and NO
 * network. The fixtures expose injectable `JwksJwtVerifier` and `IntrospectionClient`
 * implementations so the verifier core is exercised exactly as in production, but
 * with deterministic inputs.
 *
 * NB: imported only by `*.test.ts`. Filename ends `.ts` (not `.test.ts`) so vitest
 * does not collect it as a suite.
 */
import { SignJWT, jwtVerify, generateKeyPair, type CryptoKey } from "jose";
import type {
  JwksJwtVerifier,
  IntrospectionClient,
  IntrospectionResult,
} from "./verify-access-token.js";

const ALG = "ES256";

export type TokenKeys = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
};

export async function makeKeys(): Promise<TokenKeys> {
  const { publicKey, privateKey } = await generateKeyPair(ALG);
  return { publicKey, privateKey };
}

export type MintOptions = {
  subject?: string;
  audience?: string | string[];
  issuer?: string;
  workspaceId?: string | null;
  scope?: string;
  /** Seconds from now; negative ⇒ already expired. Default +300. */
  expiresInSeconds?: number;
  /** Extra raw claims. */
  extra?: Record<string, unknown>;
};

/** Mint a signed JWT access token (Hydra-shaped) for tests. */
export async function mintToken(keys: TokenKeys, opts: MintOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { ...opts.extra };
  if (opts.workspaceId !== null && opts.workspaceId !== undefined) {
    payload.workspace_id = opts.workspaceId;
  }
  if (opts.scope) payload.scope = opts.scope;

  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setSubject(opts.subject ?? "sub-default")
    .setAudience(opts.audience ?? "proxy-resource")
    .setExpirationTime(now + (opts.expiresInSeconds ?? 300));
  if (opts.issuer) builder = builder.setIssuer(opts.issuer);

  return builder.sign(keys.privateKey);
}

/**
 * A JWKS verifier bound to the fixture's public key — the in-process analogue of
 * `createRemoteJWKSet`. Verifies signature + (optionally) audience/issuer like
 * production, and throws on any failure exactly as `jose.jwtVerify` does.
 */
export function makeJwksVerifier(
  keys: TokenKeys,
  opts: { audience?: string; issuer?: string } = {},
): JwksJwtVerifier {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, keys.publicKey, {
      audience: opts.audience,
      issuer: opts.issuer,
    });
    return { payload: payload as Record<string, unknown> };
  };
}

/**
 * An introspection client backed by an in-memory table of `token → result`.
 * Unknown tokens return `{ active: false }` (fail closed). Pass `null` for a
 * token to simulate an unavailable introspection endpoint.
 */
export function makeIntrospectionClient(
  table: Record<string, IntrospectionResult | null>,
): IntrospectionClient {
  return async (token: string) => {
    if (token in table) return table[token];
    return { active: false };
  };
}
