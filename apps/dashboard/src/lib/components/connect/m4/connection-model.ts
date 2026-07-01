/**
 * M4 Connect — connection model (RES-113 PR-E).
 *
 * Pure types + helpers for the "Type → Access → Name" connection wizard and the
 * connections manager. This is the UI-SHELL model only: it carries the
 * presentational shape of a connection (method, access, name, endpoint) so the
 * wizard/manager can render the M0–M4 design faithfully.
 *
 * THE KEY IS THE CONNECTION (REC-ADR-018 addendum): a connection is realised as
 * a real Gateway key minted through the EXISTING key CRUD — no new auth model and
 * no `api_keys` schema change in this PR. The method/access "scope" shown here is
 * therefore a PRESENTATIONAL MOCK (`isMockScope: true` everywhere): enforced
 * read-vs-read+write scope and the typed connection record are PR-L (env-gated).
 * Until then, scope is purely a label/visual cue — never a security boundary.
 */

/** Connection shape. MVP exposes MCP + REST; the rest are "coming soon". */
export type ConnectionMethodId = "mcp" | "rest" | "widget" | "sdk" | "graphql";

/** Plain-language access. Mocked here; enforced in PR-L. */
export type ConnectionAccessId = "read" | "read_write";

/** Wizard step machine. `access` is skipped for methods where it is meaningless. */
export type WizardStepId = "type" | "access" | "name";

export type ConnectionMethod = {
  id: ConnectionMethodId;
  /** Display name — e.g. "MCP server". */
  name: string;
  /** Short audience tag — e.g. "For AI agents". */
  tag: string;
  /** One-line plain-language description. */
  description: string;
  /** Icon kind (see ConnectionTypeIcon.svelte) — icons, never single letters. */
  icon: ConnectionMethodId;
  /** MVP availability. Only `mcp` + `rest` are selectable; others are coming-soon. */
  available: boolean;
  /** Whether the read/read+write access step means anything for this method. */
  needsAccess: boolean;
  /** Placeholder name suggested at the Name step. */
  namePlaceholder: string;
};

export type ConnectionAccess = {
  id: ConnectionAccessId;
  /** Heading — e.g. "Read-only". */
  name: string;
  /** Human verb — e.g. "Looks up". */
  verb: string;
  /** Plain-language description. */
  description: string;
  /** Compact badge used in the manager list — "READ" / "READ+WRITE". */
  badge: string;
  /** The safe default (read-only). */
  isDefault: boolean;
};

/**
 * The connection methods, in display order. MCP + REST are live for MVP; widget,
 * SDK and GraphQL render as locked "coming soon" cards (REC-ADR-018 addendum:
 * MCP+REST only for the MVP cut).
 */
export const CONNECTION_METHODS: readonly ConnectionMethod[] = [
  {
    id: "mcp",
    name: "MCP server",
    tag: "For AI agents",
    description: "Plug your graph into Claude, Cursor, or any AI agent as a tool it can call.",
    icon: "mcp",
    available: true,
    needsAccess: true,
    namePlaceholder: "agent",
  },
  {
    id: "rest",
    name: "REST API",
    tag: "Any app",
    description: "Call your graph over HTTP from any app, in any language.",
    icon: "rest",
    available: true,
    needsAccess: true,
    namePlaceholder: "backend",
  },
  {
    id: "widget",
    name: "Chat widget",
    tag: "No code",
    description: "Drop a ready-made chat box on your site — paste one snippet, no backend.",
    icon: "widget",
    available: false,
    needsAccess: false,
    namePlaceholder: "site-chat",
  },
  {
    id: "sdk",
    name: "SDK",
    tag: "JS · Python",
    description: "Typed client libraries for JavaScript and Python.",
    icon: "sdk",
    available: false,
    needsAccess: true,
    namePlaceholder: "app",
  },
  {
    id: "graphql",
    name: "GraphQL",
    tag: "Advanced",
    description: "Query nodes, links, and clusters directly.",
    icon: "graphql",
    available: false,
    needsAccess: true,
    namePlaceholder: "explorer",
  },
] as const;

export const CONNECTION_ACCESS: readonly ConnectionAccess[] = [
  {
    id: "read",
    name: "Read-only",
    verb: "Looks up",
    description: "Asks questions and pulls back ideas. Nothing in the graph changes. The safe default.",
    badge: "READ",
    isDefault: true,
  },
  {
    id: "read_write",
    name: "Read + write",
    verb: "Looks up & contributes",
    description: "Can also add and edit ideas as it works — so the graph grows over time.",
    badge: "READ+WRITE",
    isDefault: false,
  },
] as const;

/** The honest note that read+write is a separate connection, never a toggle on one key. */
export const TWO_CONNECTIONS_NOTE =
  "Want one that looks up and one that also contributes? Make two — a read-only and a read+write are just separate connections, each with its own key.";

/** Surfaced wherever the mocked scope is shown, so the shell never over-claims. */
export const MOCK_SCOPE_NOTE =
  "Access and type are shown as labels for now. Enforced read vs read+write scope arrives with typed connections — until then every key carries today's Gateway scope.";

export function getMethod(id: ConnectionMethodId): ConnectionMethod {
  const m = CONNECTION_METHODS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown connection method: ${id}`);
  return m;
}

export function getAccess(id: ConnectionAccessId): ConnectionAccess {
  const a = CONNECTION_ACCESS.find((x) => x.id === id);
  if (!a) throw new Error(`unknown connection access: ${id}`);
  return a;
}

export function availableMethods(): ConnectionMethod[] {
  return CONNECTION_METHODS.filter((m) => m.available);
}

export function comingSoonMethods(): ConnectionMethod[] {
  return CONNECTION_METHODS.filter((m) => !m.available);
}

/**
 * The wizard steps for a given method. `access` is dropped when the method has no
 * read/write meaning (e.g. the no-code widget) so nothing is asked that does not matter.
 */
export function wizardStepsFor(method: ConnectionMethodId): WizardStepId[] {
  return getMethod(method).needsAccess ? ["type", "access", "name"] : ["type", "name"];
}

/** Next step after `current` for `method`, or null when `current` is the last step. */
export function nextWizardStep(
  current: WizardStepId,
  method: ConnectionMethodId,
): WizardStepId | null {
  const steps = wizardStepsFor(method);
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

/** Previous step before `current` for `method`, or null when `current` is the first step. */
export function prevWizardStep(
  current: WizardStepId,
  method: ConnectionMethodId,
): WizardStepId | null {
  const steps = wizardStepsFor(method);
  const i = steps.indexOf(current);
  return i > 0 ? steps[i - 1] : null;
}

/** Normalise a free-text connection name to a slug for the mock endpoint. */
export function connectionSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "connection"
  );
}

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Mock — illustrative endpoint for the manager/detail. Realistic but presentational:
 * the real per-connection routing is PR-L. Uses the workspace's own Connect API base
 * so the host looks right; the path mirrors the live HTTP surfaces.
 */
export function connectionEndpoint(params: {
  connectApiBase: string;
  method: ConnectionMethodId;
  name: string;
}): string {
  const base = trimTrailingSlash(params.connectApiBase || "https://connect.restormel.dev");
  const slug = connectionSlug(params.name);
  switch (params.method) {
    case "mcp":
      // HTTP mirror of the MCP tools (matches ConnectAgentSetup's documented mirror).
      return `${base}/connect/invoke#${slug}`;
    case "rest":
      return `${base}/connect/v1/retrieve#${slug}`;
    case "widget":
    case "sdk":
    case "graphql":
      return `${base}/connect/v1/${params.method}#${slug}`;
  }
}

/** A connection as the manager renders it (presentational; backed by a real key). */
export type ConnectionView = {
  /** The backing Gateway key id (the connection identity). */
  keyId: string;
  /** Key prefix for display (e.g. `rk_live_…`). */
  keyPrefix: string;
  /** Human name (the key label, or a derived fallback). */
  name: string;
  /** Presentational method (mock — see deriveMockMethod). */
  method: ConnectionMethodId;
  /** Presentational access (mock — see deriveMockAccess). */
  access: ConnectionAccessId;
  /** Owning project id (for delete routing). */
  projectId: string;
  /** Mock scope is always true in PR-E. */
  isMockScope: true;
};

/**
 * Mock — infer a presentational method from a key label so a list of pre-existing
 * keys renders as typed connections. Defaults to MCP (the agent path). NEVER a
 * security decision — purely cosmetic until PR-L stores a real `type`.
 */
export function deriveMockMethod(label: string | null | undefined): ConnectionMethodId {
  const l = (label ?? "").toLowerCase();
  if (/\b(rest|http|api|backend|curl)\b/.test(l)) return "rest";
  if (/\b(widget|chat|site)\b/.test(l)) return "widget";
  if (/\b(graphql|gql)\b/.test(l)) return "graphql";
  if (/\bsdk\b/.test(l)) return "sdk";
  return "mcp";
}

/**
 * Mock — infer presentational access from a key label. Defaults to read-only (the
 * safe default). NEVER enforced — PR-L gates `connect.memory.write`.
 */
export function deriveMockAccess(label: string | null | undefined): ConnectionAccessId {
  const l = (label ?? "").toLowerCase();
  if (/\b(write|rw|contribute|ingest|grow)\b/.test(l)) return "read_write";
  return "read";
}

/** Derive a connection name from a key label, falling back to a method-based default. */
export function connectionName(
  label: string | null | undefined,
  method: ConnectionMethodId,
): string {
  const l = (label ?? "").trim();
  return l || getMethod(method).namePlaceholder;
}

/** Build the manager's view of a stored Gateway key (presentational typing). */
export function connectionFromKey(key: {
  id: string;
  keyPrefix: string;
  label?: string | null;
  projectId: string;
}): ConnectionView {
  const method = deriveMockMethod(key.label);
  return {
    keyId: key.id,
    keyPrefix: key.keyPrefix,
    name: connectionName(key.label, method),
    method,
    access: deriveMockAccess(key.label),
    projectId: key.projectId,
    isMockScope: true,
  };
}

/** Live-preview rows for the wizard's "Your connection so far" panel. */
export type ConnectionPreviewRow = {
  key: string;
  value: string;
  /** Pending rows render muted until that step is reached. */
  pending: boolean;
};

export function buildWizardPreview(state: {
  method: ConnectionMethodId | null;
  access: ConnectionAccessId | null;
  name: string;
  connectApiBase: string;
}): ConnectionPreviewRow[] {
  const method = state.method ? getMethod(state.method) : null;
  const access = state.access ? getAccess(state.access) : null;
  const named = state.name.trim().length > 0;
  return [
    { key: "Type", value: method ? method.name : "choose one", pending: !method },
    {
      key: "Access",
      value: !method
        ? "—"
        : !method.needsAccess
          ? "n/a"
          : access
            ? access.name
            : "next step",
      pending: !method || (method.needsAccess && !access),
    },
    { key: "Name", value: named ? state.name.trim() : "next step", pending: !named },
    {
      key: "Endpoint",
      value: method && named
        ? connectionEndpoint({ connectApiBase: state.connectApiBase, method: state.method!, name: state.name })
        : "on create",
      pending: !(method && named),
    },
    { key: "Key", value: "on create", pending: true },
  ];
}
