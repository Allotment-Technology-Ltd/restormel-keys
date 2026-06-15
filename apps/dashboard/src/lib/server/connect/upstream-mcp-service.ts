/**
 * Verifying-proxy upstream MCP target service (REC-PLAN-010 / W2-2 Phase B, B1).
 *
 * Registers a user's own upstream MCP server (per-workspace, encrypted secret at
 * rest), resolves it back into a ready-to-dial descriptor, and runs a connection
 * test. Mirrors `graph-target-service.ts`. Security invariants:
 *
 *   - SSRF guard at WRITE-time (register) AND DIAL-time (resolve/test), via the
 *     shared `validateOutboundUrl(..., "mcp")` egress allow-list.
 *   - Cross-row uniqueness on (endpoint, namespace, database): a physical upstream
 *     belongs to exactly one workspace → `upstream_scope_conflict`.
 *   - Encrypted secret NEVER logged or serialised; the resolved descriptor exposes
 *     it only as an in-memory `secret` field for the dial, never persisted/echoed.
 *   - Flag-gated: every entrypoint asserts `RESTORMEL_VERIFYING_PROXY=1` first.
 *   - Resolver isolation: every lookup is scoped by workspaceId, so workspace A's
 *     id never resolves workspace B's target.
 */
import {
  decryptProviderSecret,
  encryptProviderSecret,
  isCredentialEncryptionConfigured,
  credentialEncryptionMisconfigReason,
} from "$lib/server/credential-crypto";
import {
  deleteUpstreamMcpTarget,
  findUpstreamMcpTargetByPhysical,
  getUpstreamMcpTargetById,
  listUpstreamMcpTargetsForWorkspace,
  updateUpstreamMcpTargetStatus,
  upsertUpstreamMcpTarget,
  type UpstreamMcpTargetRecord,
} from "$lib/server/neon";
import { validateOutboundUrl } from "$lib/server/connect/outbound-url-guard";
import { assertVerifyingProxyEnabled } from "$lib/server/connect/verifying-proxy-flag";
import { filterReadonlyTools, type McpToolDescriptor } from "$lib/server/connect/connect-readonly-profile";

export type UpstreamMcpTransport = "streamable-http" | "stdio";

/** Public (UI-safe) view of an upstream target — NEVER includes the secret. */
export type UpstreamMcpTargetPublic = {
  id: string;
  workspace_id: string;
  label: string | null;
  transport: string;
  endpoint: string;
  namespace: string | null;
  database: string | null;
  allowed_tools: string[] | null;
  secret_set: boolean;
  status: string;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function toPublic(row: UpstreamMcpTargetRecord): UpstreamMcpTargetPublic {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    label: row.label,
    transport: row.transport,
    endpoint: row.endpoint,
    namespace: row.namespace,
    database: row.database,
    allowed_tools: row.allowedTools,
    secret_set: Boolean(row.secretCiphertext),
    status: row.status,
    last_tested_at: row.lastTestedAt != null ? new Date(row.lastTestedAt).toISOString() : null,
    last_error: row.lastError,
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}

export type UpstreamMcpRegisterInput = {
  label?: string;
  transport?: UpstreamMcpTransport;
  endpoint: string;
  namespace?: string | null;
  database?: string | null;
  /** Bearer/secret for the upstream; encrypted at rest. Omit to keep an existing secret. */
  secret?: string;
  allowedTools?: string[] | null;
};

export type UpstreamMcpSaveResult =
  | { ok: true; target: UpstreamMcpTargetPublic }
  | { ok: false; status: number; error: string; message: string };

/** Encrypt the supplied secret, or signal "keep existing". Mirrors graph-target-service. */
function resolveSecretPayload(
  secret: string | undefined,
):
  | { ok: true; payload: { ciphertext: string; iv: string; authTag: string; encryptionVersion: number } | undefined }
  | { ok: false; status: number; error: string; message: string } {
  if (!secret || !secret.trim()) return { ok: true, payload: undefined };
  if (!isCredentialEncryptionConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "server_misconfigured",
      message:
        credentialEncryptionMisconfigReason() ??
        "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is not configured; cannot store the upstream secret.",
    };
  }
  const enc = encryptProviderSecret(secret.trim());
  if (!enc.ok) return { ok: false, status: 503, error: "server_misconfigured", message: enc.error };
  return {
    ok: true,
    payload: {
      ciphertext: enc.payload.ciphertextB64,
      iv: enc.payload.ivB64,
      authTag: enc.payload.authTagB64,
      encryptionVersion: enc.payload.encryptionVersion,
    },
  };
}

/**
 * Register (create or update) a workspace's upstream MCP target.
 *
 * WRITE-TIME SSRF guard runs before anything is persisted. The cross-row
 * uniqueness guard runs in code (clear error) before the DB unique index trips.
 */
export async function registerUpstreamMcpTarget(
  workspaceId: string,
  input: UpstreamMcpRegisterInput,
  opts?: { id?: string },
): Promise<UpstreamMcpSaveResult> {
  const gate = assertVerifyingProxyEnabled();
  if (!gate.ok) return gate;

  const transport: UpstreamMcpTransport = input.transport ?? "streamable-http";

  // WRITE-TIME SSRF guard (HTTP transports dial a URL; stdio is a local command).
  if (transport === "streamable-http") {
    const verdict = validateOutboundUrl(input.endpoint, "mcp");
    if (!verdict.ok) {
      return { ok: false, status: 400, error: "invalid_endpoint", message: verdict.message };
    }
  }

  // Encrypt the secret (or keep existing).
  const secret = resolveSecretPayload(input.secret);
  if (!secret.ok) return secret;

  // Cross-row uniqueness (D-d): a physical upstream belongs to exactly one workspace.
  const clash = await findUpstreamMcpTargetByPhysical({
    endpoint: input.endpoint,
    namespace: input.namespace,
    database: input.database,
  });
  if (clash && !(opts?.id && clash.id === opts.id)) {
    if (clash.workspaceId !== workspaceId) {
      return {
        ok: false,
        status: 409,
        error: "upstream_scope_conflict",
        message: "This upstream is already registered by another workspace and cannot be shared.",
      };
    }
    return {
      ok: false,
      status: 409,
      error: "upstream_scope_conflict",
      message: "This upstream (endpoint/namespace/database) is already registered in this workspace.",
    };
  }

  const label = input.label?.trim() || input.endpoint;
  let row: UpstreamMcpTargetRecord;
  try {
    row = await upsertUpstreamMcpTarget({
      id: opts?.id,
      workspaceId,
      label,
      transport,
      endpoint: input.endpoint.trim(),
      namespace: input.namespace ?? null,
      database: input.database ?? null,
      allowedTools: input.allowedTools ?? null,
      secret: secret.payload,
    });
  } catch (e) {
    // The pre-flight findUpstreamMcpTargetByPhysical check above is a TOCTOU window:
    // two concurrent INSERTs of the same physical upstream can both pass it and then
    // race the `uq_upstream_mcp_targets_physical` unique index. The loser throws a
    // Postgres unique-violation (23505). Fail closed (the duplicate IS prevented) but
    // return the SAME clean 409 as the in-code check instead of an unhandled 500.
    if (isPhysicalUpstreamConflict(e)) {
      return {
        ok: false,
        status: 409,
        error: "upstream_scope_conflict",
        message: "This upstream (endpoint/namespace/database) is already registered.",
      };
    }
    throw e;
  }
  return { ok: true, target: toPublic(row) };
}

/**
 * True when an upsert failure is the cross-row physical-uniqueness conflict
 * (`uq_upstream_mcp_targets_physical`). Matches the Postgres unique-violation SQLSTATE
 * (23505) and, as a belt-and-braces fallback, the constraint name in the message — the
 * neon serverless driver does not always surface `.code` on every wrapping.
 */
function isPhysicalUpstreamConflict(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  if (code === "23505") return true;
  const message = (e as { message?: unknown }).message;
  return (
    typeof message === "string" &&
    (message.includes("uq_upstream_mcp_targets_physical") ||
      (message.includes("duplicate key") && message.includes("upstream_mcp_targets")))
  );
}

export async function listUpstreamMcpTargets(
  workspaceId: string,
): Promise<UpstreamMcpTargetPublic[]> {
  const gate = assertVerifyingProxyEnabled();
  if (!gate.ok) return [];
  const rows = await listUpstreamMcpTargetsForWorkspace(workspaceId);
  return rows.map(toPublic);
}

export async function removeUpstreamMcpTarget(
  workspaceId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; status: 404; error: "not_found" }> {
  const gate = assertVerifyingProxyEnabled();
  if (!gate.ok) return { ok: false, status: 404, error: "not_found" };
  const deleted = await deleteUpstreamMcpTarget({ id, workspaceId });
  return deleted ? { ok: true } : { ok: false, status: 404, error: "not_found" };
}

/** Decrypt a target's secret (in-memory only). Returns null when none/failed. */
function decryptUpstreamSecret(row: UpstreamMcpTargetRecord): string | null {
  if (!row.secretCiphertext) return null;
  const res = decryptProviderSecret({
    credentialCiphertext: row.secretCiphertext,
    credentialIv: row.secretIv,
    credentialAuthTag: row.secretAuthTag,
    encryptionVersion: row.secretEncryptionVersion,
  });
  return res.ok ? res.secret : null;
}

/** Ready-to-dial upstream descriptor. Feeds the existing authorize chokepoint. */
export type UpstreamMcpDescriptor = {
  id: string;
  workspaceId: string;
  transport: string;
  endpoint: string;
  namespace: string | null;
  database: string | null;
  allowedTools: string[] | null;
  /** In-memory only; never logged, serialised, or persisted by callers. */
  secret: string | null;
};

export type ResolveResult =
  | { ok: true; descriptor: UpstreamMcpDescriptor }
  | { ok: false; status: number; error: string; message: string };

/**
 * `buildWorkspaceUpstreamMcp` — resolve a workspace's upstream target by id into a
 * ready descriptor. Workspace-scoped lookup (isolation), DIAL-TIME SSRF guard, and
 * secret decryption all happen here. The descriptor's `secret` is in-memory only.
 *
 * Pass `targetId` to select a specific saved upstream; omit to resolve the single
 * most-recent one (back-compat for single-target workspaces).
 */
export async function buildWorkspaceUpstreamMcp(
  workspaceId: string,
  targetId?: string,
): Promise<ResolveResult> {
  const gate = assertVerifyingProxyEnabled();
  if (!gate.ok) return gate;

  let row: UpstreamMcpTargetRecord | null;
  if (targetId) {
    row = await getUpstreamMcpTargetById({ id: targetId, workspaceId });
  } else {
    const all = await listUpstreamMcpTargetsForWorkspace(workspaceId);
    row = all[0] ?? null;
  }
  // Workspace-scoped query: A's id never resolves B's target → not_found.
  if (!row) {
    return { ok: false, status: 404, error: "not_found", message: "No upstream MCP target found." };
  }

  // DIAL-TIME SSRF guard — re-validate the persisted endpoint at resolve time, so a
  // row written before a tighter policy (or by a path that skipped the write guard)
  // still cannot be dialled to a private/metadata target.
  if (row.transport === "streamable-http") {
    const verdict = validateOutboundUrl(row.endpoint, "mcp");
    if (!verdict.ok) {
      return { ok: false, status: 400, error: "invalid_endpoint", message: verdict.message };
    }
  }

  return {
    ok: true,
    descriptor: {
      id: row.id,
      workspaceId: row.workspaceId,
      transport: row.transport,
      endpoint: row.endpoint,
      namespace: row.namespace,
      database: row.database,
      allowedTools: row.allowedTools,
      secret: decryptUpstreamSecret(row),
    },
  };
}

/** Default deadline (ms) for the upstream listTools probe. */
export const UPSTREAM_MCP_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RESTORMEL_UPSTREAM_MCP_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
})();

/**
 * Minimal streamable-HTTP MCP `tools/list` probe (no SDK dependency, hermetic-testable).
 * Re-validates the endpoint (dial-time SSRF) before fetching. Returns the upstream's
 * raw tool descriptors; the connect-readonly profile is applied by the caller.
 */
async function listUpstreamTools(
  descriptor: UpstreamMcpDescriptor,
): Promise<{ ok: true; tools: McpToolDescriptor[] } | { ok: false; error: string }> {
  const verdict = validateOutboundUrl(descriptor.endpoint, "mcp");
  if (!verdict.ok) return { ok: false, error: verdict.message };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (descriptor.secret) headers.Authorization = `Bearer ${descriptor.secret}`;

  let res: Response;
  try {
    res = await fetch(descriptor.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      // Do NOT follow redirects: a 3xx to a private/metadata target would bypass the
      // (string-level) SSRF guard, and following it could leak the Authorization
      // header to an attacker-chosen host. Treat any redirect as a hard failure.
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_MCP_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      return { ok: false, error: `Upstream listTools timed out after ${UPSTREAM_MCP_TIMEOUT_MS}ms` };
    }
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
  // redirect:"manual" surfaces a 3xx as an opaqueredirect response (type/status 0)
  // or a visible 3xx status — reject either rather than chase it.
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    return { ok: false, error: "Upstream MCP attempted a redirect (refused for SSRF safety)." };
  }
  if (!res.ok) return { ok: false, error: `Upstream MCP HTTP ${res.status}` };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "Invalid upstream MCP response" };
  }
  const result = (body as { result?: { tools?: unknown } } | null)?.result;
  const tools = result?.tools;
  if (!Array.isArray(tools)) {
    return { ok: false, error: "Upstream MCP returned no tools list" };
  }
  const parsed = tools
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({ ...(t as McpToolDescriptor), name: String((t as { name?: unknown }).name ?? "") }))
    .filter((t) => t.name);
  return { ok: true, tools: parsed };
}

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
  /** Read-only tool names exposed through the proxy (post connect-readonly filter). */
  readonlyTools?: string[];
};

/**
 * Connection-test: resolve → SSRF re-check → reach the upstream + listTools.
 * Persists status `ok`/`error`. NEVER stores an unreachable target as verified.
 * The returned tool list is already filtered through the connect-readonly profile.
 */
export async function testUpstreamMcpConnection(
  workspaceId: string,
  targetId: string,
): Promise<ConnectionTestResult> {
  const gate = assertVerifyingProxyEnabled();
  if (!gate.ok) return { ok: false, message: gate.message };

  const resolved = await buildWorkspaceUpstreamMcp(workspaceId, targetId);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  if (resolved.descriptor.transport !== "streamable-http") {
    return { ok: false, message: "Connection test is only supported for streamable-http upstreams." };
  }

  const listed = await listUpstreamTools(resolved.descriptor);
  if (!listed.ok) {
    await updateUpstreamMcpTargetStatus({
      id: targetId,
      workspaceId,
      status: "error",
      lastError: listed.error.slice(0, 280),
    });
    return { ok: false, message: listed.error };
  }

  const readonly = filterReadonlyTools(listed.tools, resolved.descriptor.allowedTools).map(
    (t) => t.name,
  );
  await updateUpstreamMcpTargetStatus({ id: targetId, workspaceId, status: "ok", lastError: null });
  return {
    ok: true,
    message: `Connected. ${readonly.length} read-only tool(s) available through the proxy.`,
    readonlyTools: readonly,
  };
}
