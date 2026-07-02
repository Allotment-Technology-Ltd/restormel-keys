/**
 * M4 Connect — connection model (RES-113 PR-7; REC-ADR-018 + its 2026-07-01
 * wizard-collapse addendum; copy pack §4).
 *
 * Pure types + helpers for the state-derived Connect surface:
 *   S0 — no built graph → locked state, nothing else renders.
 *   S1 — graph built, zero connections → guided fork (two method cards + name).
 *   S2 — one or more connections → manager list.
 *
 * THE KEY IS THE CONNECTION (REC-ADR-018 addendum §4): a connection is realised
 * as a purpose-bound Gateway key (type + access + target on `api_keys`). The MVP
 * ships MCP + REST only (addendum §1) — the old widget/SDK/GraphQL "coming soon"
 * cards, the Type → Access → Name step machine, and the live-preview aside are
 * deleted per the 2026-07-01 addendum (wizard collapse). Legacy keys with no
 * persisted scope still render via the label-derived fallback (`isMockScope`).
 */

/** Connection shape. MVP = MCP + REST only (REC-ADR-018 addendum §1). */
export type ConnectionMethodId = "mcp" | "rest";

/** Access scope. Enforced on flag-ON keys since PR-L (REC-ADR-018 addendum §2). */
export type ConnectionAccessId = "read" | "read_write";

export type ConnectionMethod = {
  id: ConnectionMethodId;
  /** Copy pack §4.2 card title — a user goal, not a protocol. */
  title: string;
  /** Copy pack §4.2 card description. */
  description: string;
  /** Copy pack §4.2 protocol chip — short mono operational label. */
  chip: string;
  /** Icon kind (see ConnectionTypeIcon.svelte) — icons, never single letters. */
  icon: ConnectionMethodId;
  /** Copy pack §4.2 name-field prefill. */
  namePrefill: string;
};

/**
 * The two MVP method cards, in display order — MCP first (the strategic hero),
 * REST second. Strings are the copy pack §4.2 card strings, verbatim.
 */
export const CONNECTION_METHODS: readonly ConnectionMethod[] = [
  {
    id: "mcp",
    title: "Connect an agent",
    description:
      "For Claude, ChatGPT, or any agent that supports MCP (the connector most AI agents use).",
    chip: "MCP",
    icon: "mcp",
    namePrefill: "agent",
  },
  {
    id: "rest",
    title: "Connect your own code",
    description: "For your app or backend — a simple web API your code can call.",
    chip: "REST API",
    icon: "rest",
    namePrefill: "backend",
  },
] as const;

/** Manager-list access badges (copy pack §4.4 row anatomy — mono operational labels). */
export const ACCESS_BADGE: Record<ConnectionAccessId, string> = {
  read: "READ",
  read_write: "READ + WRITE",
};

export function getMethod(id: ConnectionMethodId): ConnectionMethod {
  const m = CONNECTION_METHODS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown connection method: ${id}`);
  return m;
}

/**
 * The three Connect states (REC-ADR-018 addendum, 2026-07-01). Derivation order:
 * S0 wins whenever no graph exists — even if stray keys exist, there is nothing
 * to connect TO, matching the nav's Connect-dimmed gate (`units > 0`, the same
 * predicate `resolveJourneyNav` and Home's `deriveHomeState` share).
 */
export type ConnectSurface = "s0" | "s1" | "s2";

export function resolveConnectSurface(signals: {
  /** A built graph exists (`units > 0` — the shared graph-exists gate). */
  hasGraph: boolean;
  /** Number of existing connections (Gateway keys). */
  connectionCount: number;
}): ConnectSurface {
  if (!signals.hasGraph) return "s0";
  return signals.connectionCount >= 1 ? "s2" : "s1";
}

/**
 * Silent project resolution (REC-ADR-018 addendum §3): `setup.defaultProjectId ??
 * projects[0]`. The compact inline project chip renders ONLY when genuinely
 * ambiguous — 2+ projects and no default — never a blocking step or page.
 */
export function resolveConnectProject(setup: {
  defaultProjectId: string | null;
  projects: { id: string; name: string }[];
}): { projectId: string | null; ambiguous: boolean } {
  const projectId = setup.defaultProjectId ?? setup.projects[0]?.id ?? null;
  const ambiguous = setup.projects.length >= 2 && !setup.defaultProjectId;
  return { projectId, ambiguous };
}

/** A connection as the manager renders it (backed by a real key). */
export type ConnectionView = {
  /** The backing Gateway key id (the connection identity). */
  keyId: string;
  /** Key prefix for display (e.g. `rk_live_…`). */
  keyPrefix: string;
  /** Human name (the key label, or a derived fallback). */
  name: string;
  /** Connection method — the key's persisted `key_type` when enforced, else derived from label. */
  method: ConnectionMethodId;
  /** Access — the key's persisted `access` scope when enforced, else derived from label. */
  access: ConnectionAccessId;
  /** Owning project id (for delete routing). */
  projectId: string;
  /**
   * True when method/access are a label-derived guess on a legacy flat key (no
   * persisted scope). False when the badge reflects the key's REAL enforced scope.
   */
  isMockScope: boolean;
};

/**
 * The read+write suggestion row (copy pack §4.4) renders ONLY when exactly one
 * read-only connection exists — i.e. the estate is exactly one connection and it
 * is read-only. With a read+write connection already present (or several
 * connections) the nudge is noise, not guidance.
 */
export function showReadWriteSuggestion(connections: readonly ConnectionView[]): boolean {
  return connections.length === 1 && connections[0].access === "read";
}

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * The REAL endpoint for a connection (honesty fix — the old per-connection
 * `#slug` fragment was decorative). MCP connections point their agent at the
 * Connect API base (what `RESTORMEL_CONNECT_API_BASE` carries in the MCP
 * config); REST connections call the retrieve surface.
 */
export function connectionEndpoint(params: {
  connectApiBase: string;
  method: ConnectionMethodId;
}): string {
  const base = trimTrailingSlash(params.connectApiBase || "https://connect.restormel.dev");
  switch (params.method) {
    case "mcp":
      return base;
    case "rest":
      return `${base}/connect/v1/retrieve`;
  }
}

/**
 * Fallback — infer a presentational method from a legacy key label so stored
 * pre-PR-L keys render as typed connections. Defaults to MCP (the agent path).
 * NEVER a security decision — cosmetic only; enforced keys carry a real type.
 */
export function deriveMockMethod(label: string | null | undefined): ConnectionMethodId {
  const l = (label ?? "").toLowerCase();
  if (/\b(rest|http|api|backend|curl)\b/.test(l)) return "rest";
  return "mcp";
}

/**
 * Fallback — infer presentational access from a legacy key label. Defaults to
 * read-only (the safe default). NEVER enforced for legacy keys.
 */
export function deriveMockAccess(label: string | null | undefined): ConnectionAccessId {
  const l = (label ?? "").toLowerCase();
  if (/\b(write|rw|contribute|ingest|grow)\b/.test(l)) return "read_write";
  return "read";
}

/** Derive a connection name from a key label, falling back to the method prefill. */
export function connectionName(
  label: string | null | undefined,
  method: ConnectionMethodId,
): string {
  const l = (label ?? "").trim();
  return l || getMethod(method).namePrefill;
}

/**
 * Build the manager's view of a stored Gateway key.
 *
 * When the key carries an ENFORCED scope (`keyType` / `access` persisted on
 * api_keys via migration 074 — PR-L), the view reflects the REAL scope and
 * `isMockScope` is false. Otherwise it falls back to the label-derived guess
 * (`isMockScope: true`) — never a security decision, purely cosmetic.
 */
export function connectionFromKey(key: {
  id: string;
  keyPrefix: string;
  label?: string | null;
  projectId: string;
  /** Persisted connection type from the key (PR-L). Null/absent = derive from label. */
  keyType?: ConnectionMethodId | null;
  /** Persisted enforced access from the key (PR-L). Null/absent = derive from label. */
  access?: ConnectionAccessId | null;
}): ConnectionView {
  const enforced = key.keyType != null || key.access != null;
  const method = key.keyType ?? deriveMockMethod(key.label);
  const access = key.access ?? deriveMockAccess(key.label);
  return {
    keyId: key.id,
    keyPrefix: key.keyPrefix,
    name: connectionName(key.label, method),
    method,
    access,
    projectId: key.projectId,
    isMockScope: !enforced,
  };
}
