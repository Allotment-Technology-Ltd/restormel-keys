/**
 * RES-113 PR-L — M4 enforced key-scope decision logic ("the key IS the connection").
 *
 * Pure, dependency-free authorisation logic for the per-connection Gateway key model
 * (REC-ADR-018 addendum). A connection key carries:
 *   - a TYPE   ('mcp' | 'rest')           — the connection shape (MVP types),
 *   - an ACCESS ('read' | 'read_write')   — the ENFORCED scope, and
 *   - a TARGET (free text)                — the graph/workspace it serves (audit/display).
 *
 * The security-load-bearing rule lives in `decideMemoryWriteScope`:
 *   - read       → may retrieve, MAY NOT write memory (connect.memory.write denied),
 *   - read+write → may retrieve AND write memory,
 *   - legacy (NULL access, minted before scope existed) → grandfathered as read+write so the
 *     authorisation model is UNCHANGED for existing integrations.
 *
 * EVERYTHING here is gated behind the `onboardingJourney` module flag at the call site: when the
 * flag is OFF, `decideMemoryWriteScope` short-circuits to ALLOW for every key, so today's flat,
 * read+write-for-all behaviour is byte-for-byte preserved (REC-ADR-021 §4 — one flagged cut).
 *
 * This module performs NO IO and makes NO model/LLM/secret calls — it is the testable core the
 * server route + Connect write handler call into. Workspace/project scoping is enforced
 * STRUCTURALLY elsewhere (api_keys.project_id → projects → workspace, see connect-v1/auth.ts);
 * this adds the orthogonal read-vs-write capability scope on top.
 */

/** MVP connection shapes (REC-ADR-018 addendum §1 — MCP + REST only; others are "coming soon"). */
export type KeyConnectionType = "mcp" | "rest";

/** Enforced access scope. The plain-language M4 badge maps onto exactly these two values. */
export type KeyAccess = "read" | "read_write";

/** Connection lifecycle status. Reuses the pre-existing api_keys.status column (004). */
export type KeyConnectionStatus = "active" | "revoked";

/** A key's purpose-binding, as stored on api_keys. NULL fields = legacy/flat key (pre-PR-L). */
export type KeyScope = {
  keyType: KeyConnectionType | null;
  access: KeyAccess | null;
  target: string | null;
  status: KeyConnectionStatus | null;
};

const CONNECTION_TYPES: readonly KeyConnectionType[] = ["mcp", "rest"];
const ACCESS_LEVELS: readonly KeyAccess[] = ["read", "read_write"];

/** The access a memory write (connect.memory.write) requires. */
export const MEMORY_WRITE_REQUIRED_ACCESS: KeyAccess = "read_write";

/** Max length persisted for a connection target (defence-in-depth cap; the column is TEXT). */
export const KEY_TARGET_MAX_LENGTH = 200;

export function isValidConnectionType(value: unknown): value is KeyConnectionType {
  return typeof value === "string" && (CONNECTION_TYPES as readonly string[]).includes(value);
}

export function isValidAccess(value: unknown): value is KeyAccess {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}

/** Coerce an untrusted input to a valid connection type, or null (never throws). */
export function normalizeConnectionType(value: unknown): KeyConnectionType | null {
  return isValidConnectionType(value) ? value : null;
}

/** Coerce an untrusted input to a valid access level, or null (never throws). */
export function normalizeAccess(value: unknown): KeyAccess | null {
  return isValidAccess(value) ? value : null;
}

/** Trim + cap a target string; null when empty/absent. NEVER persists key-shaped material upstream. */
export function normalizeTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, KEY_TARGET_MAX_LENGTH);
  return t.length > 0 ? t : null;
}

export type WriteScopeDecision = {
  allowed: boolean;
  /** Machine-stable reason — surfaced in the 403 body / audit, never a raw key. */
  reason:
    | "flag_off_unscoped"
    | "non_gateway_auth"
    | "read_write_scope"
    | "legacy_unscoped_grandfathered"
    | "read_scope_denied"
    | "revoked_key_denied";
};

/**
 * Decide whether a memory-write (connect.memory.write) is authorised for the calling key.
 *
 * Order is security-relevant:
 *   1. flag OFF                       → ALLOW (today's behaviour; nothing enforced yet),
 *   2. non-gateway auth (session /    → ALLOW (workspace owner / management admin are not
 *      management key)                  scoped *connections* — they are not narrowed by this
 *                                        capability scope; their own auth already bounds them),
 *   3. revoked key                    → DENY,
 *   4. access === 'read'              → DENY (the read badge means what it says),
 *   5. access === 'read_write'        → ALLOW,
 *   6. legacy NULL access             → ALLOW (grandfathered as read+write — no break for keys
 *                                        minted before scope existed).
 */
export function decideMemoryWriteScope(args: {
  authType: string | null | undefined;
  access: KeyAccess | null | undefined;
  status?: KeyConnectionStatus | null | undefined;
  flagEnabled: boolean;
}): WriteScopeDecision {
  if (!args.flagEnabled) return { allowed: true, reason: "flag_off_unscoped" };

  // Only Gateway keys are per-connection scoped credentials. Session (workspace owner) and
  // management-key (workspace admin) auth are NOT narrowed by the read/read+write connection
  // scope — enforcing it on them would wrongly lock owners out of their own graph.
  if (args.authType !== "gateway_key") return { allowed: true, reason: "non_gateway_auth" };

  if (args.status === "revoked") return { allowed: false, reason: "revoked_key_denied" };

  if (args.access === "read") return { allowed: false, reason: "read_scope_denied" };
  if (args.access === "read_write") return { allowed: true, reason: "read_write_scope" };

  // access == null/undefined → legacy key minted before scope existed. Grandfather as read+write
  // so the authorisation model is unchanged for existing integrations (additive cut).
  return { allowed: true, reason: "legacy_unscoped_grandfathered" };
}

/** Human-facing message for a denied memory write (no key material; safe to return to the client). */
export function writeScopeDenialMessage(decision: WriteScopeDecision): string {
  if (decision.reason === "revoked_key_denied") {
    return "This connection key has been revoked. Mint a new read+write connection to write memory.";
  }
  return "This connection is read-only (look-up only). Writing to memory needs a read+write connection — create one to let an agent contribute back.";
}
