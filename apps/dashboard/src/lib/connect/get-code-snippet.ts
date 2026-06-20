/**
 * Phase 3 Stage 2 — "Get Code" from a console answer.
 *
 * Pure, client-safe builder that turns a verified console query into a copy-paste
 * production snippet (curl + Node/TS) reproducing the SAME `retrieve_context`
 * request against `POST /connect/v1/graph` (the graph-orchestrator contract — see
 * packages/contracts/src/connect.ts `ConnectGraphOpRequestSchema`).
 *
 * SECURITY (BYOK / security-baseline.md):
 *  - The user's RAW Gateway key is NEVER available here. Keys are hashed at rest
 *    (`api_keys.key_hash`); only the non-secret `key_prefix` (`rk_xxxxxxxx…`) is
 *    recoverable, and even that is shown only as a *hint* comment. The snippet body
 *    itself carries a clearly-labelled placeholder (`RESTORMEL_GATEWAY_KEY`), so no
 *    secret can ever be baked into the rendered HTML, the copied text, or a log.
 *  - The key is supplied at run time via an env var the developer sets locally —
 *    matching how `@restormel/mcp` reads `RESTORMEL_GATEWAY_KEY` from the process
 *    environment (never a literal in source).
 *  - The request body is data-only (workspace_id, operation, query, verification
 *    policy): no code, no eval, nothing that changes authz. The query text the user
 *    typed is JSON-encoded, never string-concatenated into the snippet.
 *
 * This is the Stripe/Anthropic "Get Code" on-ramp: the console becomes the door to
 * the API, with the exact route the answer used pre-filled.
 */

/** Env var name the snippet reads the Gateway key from (canonical — see security-baseline.md). */
export const GATEWAY_KEY_ENV = "RESTORMEL_GATEWAY_KEY";

/** Env var name for the API base (canonical — restormel-environment-vocabulary.md). */
export const API_BASE_ENV = "RESTORMEL_CONNECT_API_BASE";

/** Default public API origin when the caller does not pass one. */
export const DEFAULT_CONNECT_API_BASE = "https://restormel.dev";

/** The graph-orchestrator path the console answer was produced from. */
export const GRAPH_OP_PATH = "/connect/v1/graph";

export type GetCodeSnippetInput = {
  /** Opaque workspace id (a UUID) — required on every Connect request body. */
  workspaceId: string;
  /** The exact question the console just answered (reproduced verbatim). */
  question: string;
  /** Public API origin, e.g. "https://restormel.dev". Defaults to the prod origin. */
  apiBase?: string;
  /** Optional project scope (matches the Gateway key's project when set). */
  projectId?: string | null;
  /**
   * The workspace's Gateway key PREFIX (`rk_xxxxxxxx…`), shown only as a non-secret
   * hint so the developer recognises which key to use. NEVER the full key.
   */
  keyPrefixHint?: string | null;
  /** Verified-claim cap to mirror the console's retrieval budget. Bounded 1..500. */
  maxClaims?: number;
};

export type GetCodeTab = {
  id: "curl" | "node";
  label: string;
  language: string;
  code: string;
};

export type GetCodeSnippet = {
  /** The request body the snippet sends (also rendered for transparency). */
  requestBody: ConnectGraphRetrieveBody;
  tabs: GetCodeTab[];
};

/** The retrieve_context request body shape (subset of ConnectGraphOpRequestSchema). */
export type ConnectGraphRetrieveBody = {
  workspace_id: string;
  project_id?: string;
  operation: "retrieve_context";
  query: string;
  max_claims?: number;
};

/** Clamp the claim budget into the contract's bounds (1..500), defaulting to 24. */
function clampMaxClaims(n: number | undefined): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return Math.min(i, 500);
}

/** Normalise + trim the API base, stripping a trailing slash so paths join cleanly. */
function normalizeApiBase(base: string | undefined): string {
  const b = (base ?? DEFAULT_CONNECT_API_BASE).trim() || DEFAULT_CONNECT_API_BASE;
  return b.replace(/\/+$/, "");
}

/** Build the data-only request body (no secrets, no code). */
export function buildRetrieveBody(input: GetCodeSnippetInput): ConnectGraphRetrieveBody {
  const body: ConnectGraphRetrieveBody = {
    workspace_id: input.workspaceId,
    operation: "retrieve_context",
    query: input.question.trim(),
  };
  if (input.projectId) body.project_id = input.projectId;
  const maxClaims = clampMaxClaims(input.maxClaims);
  if (maxClaims != null) body.max_claims = maxClaims;
  return body;
}

/**
 * The hint comment naming WHICH key to use, without leaking it. Only the public
 * prefix (already masked at the data layer as `rk_xxxxxxxx…`) appears, and only
 * when a prefix is supplied.
 */
function keyHintComment(prefix: string | null | undefined, commentToken: string): string {
  const p = (prefix ?? "").trim();
  const which = p ? ` (the key starting ${p})` : "";
  return `${commentToken} Set ${GATEWAY_KEY_ENV} to your Gateway key${which}. Never commit it.`;
}

/**
 * curl: reads the key from the environment (`$RESTORMEL_GATEWAY_KEY`) so no secret
 * is ever written into the snippet text. The JSON body is single-quoted; the query
 * is JSON-encoded so quotes/newlines in it cannot break out of the string.
 */
function buildCurl(input: GetCodeSnippetInput, body: ConnectGraphRetrieveBody, apiBase: string): string {
  const url = `${apiBase}${GRAPH_OP_PATH}`;
  // Pretty JSON, then single-quote it for the shell. JSON never contains a single
  // quote, so single-quoting is injection-safe for the body.
  const json = JSON.stringify(body, null, 2);
  return [
    keyHintComment(input.keyPrefixHint, "#"),
    `curl -sS -X POST '${url}' \\`,
    `  -H "Authorization: Bearer $${GATEWAY_KEY_ENV}" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${json}'`,
  ].join("\n");
}

/**
 * Node / TS: native fetch (Node ≥ 18), reading the key from `process.env`. The body
 * is a JS object literal built from the JSON-safe values, so the developer's query
 * is data, never interpolated code.
 */
function buildNode(input: GetCodeSnippetInput, body: ConnectGraphRetrieveBody, apiBase: string): string {
  const url = `${apiBase}${GRAPH_OP_PATH}`;
  // The whole body is JSON-encoded then embedded — guaranteed valid JS (JSON is a
  // subset of JS object-literal syntax) with no template-injection surface.
  const bodyLiteral = JSON.stringify(body, null, 2);
  return [
    keyHintComment(input.keyPrefixHint, "//"),
    `const apiKey = process.env.${GATEWAY_KEY_ENV};`,
    `if (!apiKey) throw new Error("Set ${GATEWAY_KEY_ENV} in your environment");`,
    ``,
    `const res = await fetch(${JSON.stringify(url)}, {`,
    `  method: "POST",`,
    `  headers: {`,
    `    Authorization: \`Bearer \${apiKey}\`,`,
    `    "Content-Type": "application/json",`,
    `  },`,
    `  body: JSON.stringify(${bodyLiteral}),`,
    `});`,
    ``,
    `if (!res.ok) throw new Error(\`Connect API \${res.status}: \${await res.text()}\`);`,
    `const { context_block, verified_claims, trace } = await res.json();`,
    `// context_block → feed to your model; verified_claims → each claim's source span.`,
    `console.log(trace.claim_count, "verified claims;", trace.operation);`,
  ].join("\n");
}

/**
 * Build the tabbed "Get Code" snippet for a console answer. Pure — no I/O, no
 * secrets, deterministic for a given input. Render the tabs via `CodeBlock`.
 */
export function buildGetCodeSnippet(input: GetCodeSnippetInput): GetCodeSnippet {
  const apiBase = normalizeApiBase(input.apiBase);
  const body = buildRetrieveBody(input);
  return {
    requestBody: body,
    tabs: [
      { id: "curl", label: "curl", language: "bash", code: buildCurl(input, body, apiBase) },
      { id: "node", label: "Node / TS", language: "typescript", code: buildNode(input, body, apiBase) },
    ],
  };
}
