/**
 * Wrapped-MCP scenario fixture (Stage-5 in-path economic read — REC-ADR-023 §"validation";
 * restormel-verification-engineering §7 "harness inputs are dual").
 *
 * STUB, HONESTLY LABELLED: connect-core carries no MCP SDK / network dep, so these responses
 * stand in for what a wrapped commodity MCP server (Redis Iris — the named candidate on the
 * signal shelf) would return. `runWrappedMcpScenario(..., mcpWrappingIsStub: true)` records
 * that the callTool leg is NOT measured here — only the Restormel verify legs. A live runner
 * (host app, real credential + real server) folds in callTool latency and flips the label.
 */
import type { McpResponseClaim } from "../harness.js";

const H = (docId: string) => `mcp-fixture-hash-${docId}`;

/**
 * Third-party responses (claim + the source span the wrapped server cited) to verify in-path.
 * Mix of supportable and unsupportable, so the in-path economics reflect a realistic tier
 * distribution and abstention rate rather than an all-cheap-tier best case.
 */
export const REDIS_IRIS_STUB_CLAIMS: McpResponseClaim[] = [
  {
    ref: "mcp-1",
    serverId: "redis-iris-stub",
    claim: "The cache eviction policy defaults to LRU.",
    span: "By default, the eviction policy is set to allkeys-lru (least recently used).",
    sourceVersionHash: H("iris-doc-1"),
    sourceDocId: "iris-doc-1",
  },
  {
    ref: "mcp-2",
    serverId: "redis-iris-stub",
    claim: "Keys never expire unless a TTL is set.",
    span: "A key persists until it is explicitly deleted or, if a TTL is set, until the TTL elapses.",
    sourceVersionHash: H("iris-doc-1"),
    sourceDocId: "iris-doc-1",
  },
  {
    ref: "mcp-3",
    serverId: "redis-iris-stub",
    claim: "The server supports SQL joins across key spaces.",
    span: "The module provides key-value get/set operations and pub/sub messaging.",
    sourceVersionHash: H("iris-doc-2"),
    sourceDocId: "iris-doc-2",
  },
  {
    ref: "mcp-4",
    serverId: "redis-iris-stub",
    claim: "Replication is synchronous by default.",
    span: "Replication is asynchronous by default; synchronous replication requires WAIT.",
    sourceVersionHash: H("iris-doc-2"),
    sourceDocId: "iris-doc-2",
  },
  {
    ref: "mcp-5",
    serverId: "redis-iris-stub",
    // Absent evidence: the wrapped server returned no supporting span.
    claim: "The default TCP port is 7777.",
    span: "",
    sourceVersionHash: H("iris-doc-2"),
    sourceDocId: "iris-doc-2",
  },
];
