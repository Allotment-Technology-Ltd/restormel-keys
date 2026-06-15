/**
 * `connect-readonly` tool profile (REC-PLAN-010 / W2-2 Phase B, B3).
 *
 * Deny-by-default gate over the tools an upstream MCP server exposes through the
 * verifying proxy. Only read / query / verify-class tools are surfaced; every
 * write / admin / mutate tool is gated OFF.
 *
 * Defence at BOTH points:
 *   - `filterReadonlyTools` — applied when answering `listTools` (hide).
 *   - `isToolAllowedReadonly` / `assertToolAllowedReadonly` — applied on dispatch
 *     (reject), so a client that already knows a hidden tool name still cannot call it.
 *
 * The decision is deny-by-default: a tool is allowed ONLY when its name matches the
 * read allow-set AND does not match any write/admin deny pattern. An unknown tool
 * (matching neither) is DENIED. An optional per-target `allowedTools` list further
 * narrows the surface (intersection) but can never widen it past the readonly rules.
 */

export type McpToolDescriptor = {
  name: string;
  description?: string;
  /** Some MCP tools advertise their effect; honoured when present. */
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  [k: string]: unknown;
};

/**
 * Read / query / verify-class verbs that are SAFE to expose read-only. Matched as
 * whole tokens (split on non-alphanumerics) or as a leading verb, so `list_tools`,
 * `search-docs`, `getResource`, `verify.claim` all match without matching `delete`.
 */
const READ_VERB_ALLOW = new Set([
  "get",
  "list",
  "read",
  "fetch",
  "search",
  "query",
  "find",
  "lookup",
  "describe",
  "inspect",
  "view",
  "show",
  "retrieve",
  "verify",
  "validate",
  "check",
  "resolve",
  "explain",
  "preview",
  "count",
  "stat",
  "stats",
  "status",
  "ping",
  "health",
]);

/**
 * Write / admin / mutate verbs that are ALWAYS denied even if a read verb also
 * appears in the name (e.g. `get_and_delete`). This is the load-bearing deny side.
 */
const WRITE_VERB_DENY = new Set([
  "create",
  "write",
  "update",
  "delete",
  "remove",
  "drop",
  "insert",
  "upsert",
  "patch",
  "put",
  "post",
  "set",
  "add",
  "edit",
  "modify",
  "rename",
  "move",
  "copy",
  "execute",
  "exec",
  "run",
  "invoke",
  "call",
  "send",
  "publish",
  "deploy",
  "apply",
  "grant",
  "revoke",
  "admin",
  "configure",
  "config",
  "manage",
  "provision",
  "reset",
  "purge",
  "truncate",
  "destroy",
  "kill",
  "stop",
  "start",
  "restart",
  "transfer",
  "pay",
  "charge",
  "approve",
  "merge",
  "import",
  "export",
  "upload",
  "sync",
]);

/**
 * Tokenise a tool name into lower-case alphanumeric words. Splits on
 * non-alphanumerics AND camelCase / PascalCase boundaries so `queryGraph`,
 * `fetchResource`, and `getAndDelete` all yield their constituent verbs (and a
 * write verb can never hide behind a camel hump).
 */
function tokens(name: string): string[] {
  return name
    // insert a separator at lower→Upper and Upper→UpperLower boundaries
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

/**
 * Classify a single tool name as read-only-safe under the deny-by-default rules.
 * - Any write/admin token → DENY.
 * - Otherwise at least one read token must be present → ALLOW.
 * - No recognised token at all → DENY (unknown is not safe).
 */
export function isReadonlyToolName(name: string): boolean {
  const toks = tokens(name);
  if (toks.length === 0) return false;
  if (toks.some((t) => WRITE_VERB_DENY.has(t))) return false;
  return toks.some((t) => READ_VERB_ALLOW.has(t));
}

export type ReadonlyDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * Full per-tool decision used at BOTH list-time and dispatch-time.
 *
 * @param tool          the tool descriptor (name + optional annotations)
 * @param allowedTools  optional per-target explicit allow-list; when set, the tool
 *                      MUST also be a member (intersection — narrows, never widens).
 */
export function evaluateReadonlyTool(
  tool: Pick<McpToolDescriptor, "name" | "annotations">,
  allowedTools?: readonly string[] | null,
): ReadonlyDecision {
  const name = (tool.name ?? "").trim();
  if (!name) return { allowed: false, reason: "unnamed tool" };

  // An explicit destructive hint is dispositive — deny regardless of the name.
  if (tool.annotations?.destructiveHint === true) {
    return { allowed: false, reason: "tool annotated destructive" };
  }
  // A readOnlyHint:false is a clear write signal.
  if (tool.annotations?.readOnlyHint === false) {
    return { allowed: false, reason: "tool annotated non-read-only" };
  }

  if (!isReadonlyToolName(name)) {
    return { allowed: false, reason: "tool is not in the read-only allow-set" };
  }

  if (allowedTools && allowedTools.length > 0 && !allowedTools.includes(name)) {
    return { allowed: false, reason: "tool not in this target's allowed_tools" };
  }

  return { allowed: true };
}

/** list-time hide: return only the read-only-safe tools. */
export function filterReadonlyTools<T extends Pick<McpToolDescriptor, "name" | "annotations">>(
  tools: readonly T[],
  allowedTools?: readonly string[] | null,
): T[] {
  return tools.filter((t) => evaluateReadonlyTool(t, allowedTools).allowed);
}

/** dispatch-time check (boolean). */
export function isToolAllowedReadonly(
  toolName: string,
  opts?: { allowedTools?: readonly string[] | null; annotations?: McpToolDescriptor["annotations"] },
): boolean {
  return evaluateReadonlyTool(
    { name: toolName, annotations: opts?.annotations },
    opts?.allowedTools,
  ).allowed;
}

/** dispatch-time guard that returns a structured rejection (for the proxy handler). */
export function assertToolAllowedReadonly(
  toolName: string,
  opts?: { allowedTools?: readonly string[] | null; annotations?: McpToolDescriptor["annotations"] },
): { ok: true } | { ok: false; status: 403; error: "tool_not_allowed"; message: string } {
  const decision = evaluateReadonlyTool(
    { name: toolName, annotations: opts?.annotations },
    opts?.allowedTools,
  );
  if (decision.allowed) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "tool_not_allowed",
    message: `Tool "${toolName}" is blocked by the connect-readonly profile (${decision.reason}).`,
  };
}
