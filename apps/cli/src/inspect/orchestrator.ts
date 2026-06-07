/**
 * orchestrator — local (--graph-store) inspect mode. Wires @restormel/graphrag-core
 * directly to a BYO graph store (the same pattern as apps/mcp-server/src/graph-store.ts)
 * and replicates the inspect_query logic: retrieve permissively, then partition the
 * candidates by re-applying the configured policy in-process so the CLI can show what
 * a supported-only default is hiding.
 */
import {
  createGraphStoreAdapter,
  philosophyRetrievalConfig,
  RetrievalOrchestrator,
  type AdapterFactoryDeps,
  type EmbeddingPort,
  type GraphRagDeps,
  type GraphStore,
  type GraphStoreConnectionConfig,
  type RetrievalConfig,
  type RetrievedClaim,
  type VerificationCategory,
  type VerificationPolicy,
} from "@restormel/graphrag-core";
import type { ResolvedConfig } from "../config.js";
import type { ClaimView, InspectResult, InspectOptions } from "./types.js";

const ALL_CATEGORIES: VerificationCategory[] = ["supported", "weak", "unsupported"];

/** Raised when the graph store cannot be reached, so the CLI can print a targeted hint. */
export class GraphStoreUnreachableError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
    this.name = "GraphStoreUnreachableError";
  }
}

/** A connection over the BYO SurrealDB HTTP /sql API (no driver dependency). */
class SurrealHttpGraphStore implements GraphStore {
  constructor(
    private readonly url: string,
    private readonly creds: { username?: string; password?: string },
  ) {}

  async query<T>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const preamble = vars
      ? Object.entries(vars)
          .map(([k, v]) => `LET $${k} = ${JSON.stringify(v)};`)
          .join("\n")
      : "";
    const body = preamble ? `${preamble}\n${sql}` : sql;

    const headers: Record<string, string> = {
      "Content-Type": "text/plain",
      Accept: "application/json",
    };
    const { namespace, database } = parseSurrealTarget(this.url);
    if (namespace) headers["surreal-ns"] = namespace;
    if (database) headers["surreal-db"] = database;
    if (this.creds.username && this.creds.password) {
      const token = Buffer.from(`${this.creds.username}:${this.creds.password}`).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(stripSurrealTarget(this.url), { method: "POST", headers, body });
    } catch (err) {
      throw new GraphStoreUnreachableError(
        err instanceof Error ? err.message : String(err),
        this.url,
      );
    }
    if (!res.ok) {
      throw new GraphStoreUnreachableError(`graph store returned HTTP ${res.status}`, this.url);
    }
    const payload = (await res.json()) as Array<{ status?: string; result?: unknown }>;
    const envelopes = Array.isArray(payload) ? payload : [];
    const last = envelopes[envelopes.length - 1];
    return (last?.result ?? []) as T;
  }

  isDatabaseUnavailable(error: unknown): boolean {
    return error instanceof GraphStoreUnreachableError;
  }
}

function parseSurrealTarget(rawUrl: string): { namespace?: string; database?: string } {
  try {
    const u = new URL(rawUrl);
    const ns = u.searchParams.get("ns") ?? u.searchParams.get("namespace") ?? undefined;
    const db = u.searchParams.get("db") ?? u.searchParams.get("database") ?? undefined;
    if (ns || db) return { namespace: ns ?? undefined, database: db ?? undefined };
    const segments = u.pathname.split("/").filter(Boolean);
    const sqlIdx = segments.indexOf("sql");
    if (sqlIdx >= 0 && segments.length >= sqlIdx + 3) {
      return { namespace: segments[sqlIdx + 1], database: segments[sqlIdx + 2] };
    }
    return {};
  } catch {
    return {};
  }
}

function stripSurrealTarget(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.search = "";
    const segments = u.pathname.split("/").filter(Boolean);
    const sqlIdx = segments.indexOf("sql");
    if (sqlIdx >= 0) {
      u.pathname = "/" + segments.slice(0, sqlIdx + 1).join("/");
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** No-op embedder: standalone runs without an embedding model fall back to lexical retrieval. */
const noopEmbedder: EmbeddingPort = {
  embedQuery: async () => [] as number[],
};

interface GraphRuntime {
  orchestrator: RetrievalOrchestrator;
  retrievalConfig: RetrievalConfig;
}

function buildGraphRuntime(config: ResolvedConfig): GraphRuntime {
  const retrievalConfig = philosophyRetrievalConfig;
  const edgeTables = retrievalConfig.relations.traversalEdges.map((e) => e.table);

  const connectionConfig: GraphStoreConnectionConfig = {
    type: config.graphStoreType,
    schemaMode: "fresh",
    credentials: config.graphStoreCreds,
  };

  const store = new SurrealHttpGraphStore(config.graphStore as string, config.graphStoreCreds);
  const factoryDeps: AdapterFactoryDeps = { defaultEdgeTables: edgeTables };
  if (config.graphStoreType === "surrealdb") {
    factoryDeps.surrealStore = store;
  }
  // Adapter built to mirror the mcp-server wiring; the orchestrator drives retrieval.
  createGraphStoreAdapter(connectionConfig, factoryDeps);

  const deps: GraphRagDeps = {
    store,
    embedder: noopEmbedder,
    resolveOriginBucket: () => "other",
  };

  const orchestrator = new RetrievalOrchestrator(retrievalConfig, deps);
  return { orchestrator, retrievalConfig };
}

function categoryOf(claim: RetrievedClaim): VerificationCategory {
  if (claim.verification_category) return claim.verification_category;
  return "weak";
}

/** Re-apply the policy in-process to decide if a candidate survives, and the human reason if not. */
function evaluate(
  claim: RetrievedClaim,
  policy: VerificationPolicy,
): { admitted: boolean; reason?: string; reasonCode?: ClaimView["filterReasonCode"] } {
  const category = categoryOf(claim);
  const trust = claim.trust_score ?? null;

  if (category === "unsupported" && policy.excludeFlagged !== false) {
    return {
      admitted: false,
      reason: "verification_state = unsupported",
      reasonCode: "unsupported",
    };
  }
  if (!policy.include.includes(category)) {
    return {
      admitted: false,
      reason: `category "${category}" not in policy include=[${policy.include.join(",")}]`,
      reasonCode: "excluded-category",
    };
  }
  if (
    policy.minTrustScore !== undefined &&
    typeof trust === "number" &&
    trust < policy.minTrustScore
  ) {
    return {
      admitted: false,
      reason: `trust_score below workspace minimum (${policy.minTrustScore})`,
      reasonCode: "below-threshold",
    };
  }
  return { admitted: true };
}

function policyLabel(policy: VerificationPolicy): string {
  const flags = policy.excludeFlagged === false ? "include-flagged" : "exclude-flagged";
  const trust = policy.minTrustScore !== undefined ? `, minTrust=${policy.minTrustScore}` : "";
  return `include=[${policy.include.join(",")}], ${flags}${trust}`;
}

function toClaimView(
  claim: RetrievedClaim,
  opts: { hopDepth: number; via: string },
): ClaimView {
  return {
    claimId: claim.id,
    claimText: claim.text,
    sourceRef: claim.source_title || "unknown",
    category: categoryOf(claim),
    verificationState: claim.verification_state ?? claim.verification_category ?? "unknown",
    confidenceScore: claim.confidence ?? 0,
    trustScore: claim.trust_score ?? 0,
    hopDepth: opts.hopDepth,
    via: opts.via,
  };
}

/** Build the verification policy to inspect against from the inspect options. */
export function buildPolicy(options: InspectOptions): VerificationPolicy {
  const include: VerificationCategory[] = ["supported"];
  if (options.includeWeak) include.push("weak");
  if (options.includeUnsupported) include.push("unsupported");
  return {
    include,
    excludeFlagged: !options.includeUnsupported,
    ...(options.minTrustScore !== undefined ? { minTrustScore: options.minTrustScore } : {}),
  };
}

/**
 * The engine logs diagnostics via console.log (stdout). Route those to stderr
 * for the duration of a call so stdout stays clean for --format json output.
 */
async function withStdoutQuiet<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalInfo = console.info;
  console.log = (...args: unknown[]) => process.stderr.write(args.map(String).join(" ") + "\n");
  console.info = console.log;
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
  }
}

/** Run a local inspect against the configured graph store and partition the candidates. */
export async function runLocalInspect(
  config: ResolvedConfig,
  query: string,
  options: InspectOptions,
): Promise<InspectResult> {
  const { orchestrator } = buildGraphRuntime(config);

  const permissive: VerificationPolicy = {
    include: ALL_CATEGORIES,
    excludeFlagged: false,
  };

  const result = await withStdoutQuiet(() =>
    orchestrator.retrieveContext({
      query,
      maxDepth: options.depth,
      maxTokens: options.maxTokens,
      verificationPolicy: permissive,
    }),
  );

  // The engine degrades to an empty result instead of throwing when the store is
  // unreachable; promote that to an error so the CLI can print a targeted hint.
  if (result.trace.degraded && result.trace.degraded_reason === "database_unavailable") {
    throw new GraphStoreUnreachableError("graph store reported database_unavailable", config.graphStore as string);
  }

  const policy = buildPolicy(options);
  const seeds = new Set(result.subgraph.seed_claim_ids);

  const wouldRetrieve: ClaimView[] = [];
  const filteredOut: ClaimView[] = [];

  for (const claim of result.subgraph.claims) {
    const isSeed = seeds.has(claim.id);
    const hopDepth = isSeed ? 1 : 2;
    const via = isSeed ? "seed" : "traversal";
    const verdict = evaluate(claim, policy);
    if (verdict.admitted) {
      const view = toClaimView(claim, { hopDepth, via });
      if (view.category === "weak" && options.includeWeak) {
        view.note = "included because --include-weak is set";
      }
      wouldRetrieve.push(view);
    } else {
      const view = toClaimView(claim, { hopDepth, via });
      view.filterReason = verdict.reason;
      view.filterReasonCode = verdict.reasonCode;
      filteredOut.push(view);
    }
  }

  const trace = result.trace;
  return {
    query,
    workspace: config.workspace,
    domain: result.subgraph.claims[0]?.domain,
    policyLabel: policyLabel(policy),
    wouldRetrieve,
    filteredOut,
    traceSummary: {
      seedCount: trace.seed_count,
      hops: trace.hops,
      candidatesEvaluated: result.subgraph.claims.length,
      retrieved: wouldRetrieve.length,
      filtered: filteredOut.length,
      tokensUsed: trace.tokens_used,
      tokenBudget: options.maxTokens,
      nodesDropped: trace.nodes_dropped,
      truncated: trace.nodes_dropped > 0,
    },
  };
}
