/**
 * connect.retrieve_verified — verified-claim envelope retrieval tool (Stage 4.1).
 *
 * Returns Connect v1 retrieve results shaped as VerifiedClaimEnvelope arrays
 * (packages/contracts/src/verified-claim.ts). Two modes:
 *
 *   strict     — returns ONLY claims whose state is "supported" (evidence-bound AND
 *                entailed per EBV Layers 1+2). Unverified, contradicted, excluded, and
 *                inferred claims are omitted entirely. Use when the calling agent must
 *                cite exclusively verified content.
 *
 *   annotated  — returns ALL claims regardless of state, with the full verified-claim
 *                envelope on each entry so the agent can inspect and label claim quality.
 *                Unverified/non-supported claims are present but their state is explicit —
 *                never silently blended.
 *
 * CITING: When you use content from this tool, always:
 *   1. Quote the exact text from evidence[].quote (not a paraphrase).
 *   2. Attribute to citation (the source title) — cite it as "(Source: <citation>)".
 *   3. If trace_export_url is present, include it as the audit link for your citation.
 *   4. Never represent an "inferred", "unverified", "contradicted", or "excluded" claim
 *      as a confirmed fact; label them appropriately (e.g. "reportedly", "unconfirmed").
 *
 * Auth: RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY (Gateway key rk_…).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { VerifiedClaimEnvelopeSchema, type VerifiedClaimEnvelope } from "@restormel/contracts/verified-claim";
import { connectProxyPost } from "./connect-tools-logic.js";
import type { RestormelSuiteToolName } from "./suite-tool-names.js";

/** Tool schema version — bump when the output shape changes in a breaking way. */
export const VERIFIED_RETRIEVAL_TOOL_VERSION = "1.0.0";

type ToolReg = (
  name: RestormelSuiteToolName,
  config: { description: string; inputSchema: Record<string, z.ZodType>; outputSchema: Record<string, z.ZodType> },
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; structuredContent: unknown }>,
) => void;

/** EBV vocabulary — these are the states from verified-claim.ts. */
export const EBV_STATES = ["supported", "inferred", "unverified", "contradicted", "excluded"] as const;
export type EbvState = (typeof EBV_STATES)[number];

/** Strict mode: only these states pass. */
const STRICT_ALLOWED: ReadonlySet<EbvState> = new Set(["supported"]);

export const verifiedRetrievalInputSchema = {
  query: z
    .string()
    .min(1)
    .describe("Natural-language query over the workspace knowledge graph."),
  mode: z
    .enum(["strict", "annotated"])
    .optional()
    .describe(
      "strict (default): return ONLY supported-state claims; every result is fully evidence-bound and entailed. " +
        "annotated: return all claims with their EBV state (supported|inferred|unverified|contradicted|excluded) " +
        "so you can see the full picture and label non-supported content appropriately.",
    ),
  depth: z
    .enum(["quick", "standard", "deep"])
    .optional()
    .describe("Context pack depth (default: standard)."),
  workspace_id: z
    .string()
    .uuid()
    .optional()
    .describe("Keys workspace id. Defaults to RESTORMEL_WORKSPACE_ID env when omitted."),
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe("Keys project id when required by your Gateway key scope."),
  max_claims: z.number().int().positive().max(500).optional(),
  domain_hint: z.string().optional(),
};

export const verifiedRetrievalOutputSchema = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  tool_version: z.string().optional(),
  mode: z.enum(["strict", "annotated"]).optional(),
  contract_version: z.string().optional(),
  request_id: z.string().optional(),
  claims: z
    .array(
      z.object({
        claim: z.object({ id: z.string(), text: z.string() }),
        state: z.enum(EBV_STATES),
        evidence: z
          .array(
            z.object({
              quote: z.string(),
              offsets: z.tuple([z.number(), z.number()]),
              source_ref: z.string().nullable(),
              source_hash: z.string().nullable(),
              match: z.string().nullable().optional(),
            }),
          )
          .optional(),
        judge: z
          .object({
            model: z.string().nullable(),
            prompt_version: z.number(),
            confidence: z.number().nullable(),
            at: z.string(),
          })
          .optional(),
        citation: z.string().nullable().optional(),
        trace_ref: z.string().nullable().optional(),
        trace_export_url: z.string().nullable().optional(),
        trust_score: z.number().nullable().optional(),
      }),
    )
    .optional(),
  total_retrieved: z.number().optional(),
  total_after_mode_filter: z.number().optional(),
  verification_summary: z.record(z.string(), z.number()).optional(),
  metadata: z.unknown().optional(),
  upstreamStatus: z.number().optional(),
};

/** Tool description — written so the calling agent learns to cite correctly. */
export const VERIFIED_RETRIEVAL_TOOL_DESCRIPTION =
  "Retrieve verified-claim envelopes from a Restormel Connect knowledge graph. " +
  "Each result carries: the claim text, its EBV verification state " +
  "(supported|inferred|unverified|contradicted|excluded), bound evidence spans " +
  "(verbatim quote + character offsets + source hash — deterministically re-checkable), " +
  "the entailment judge attribution, the source citation (title), and a provenance " +
  "trace export URL for auditors.\n\n" +
  "MODE:\n" +
  "  strict (default) — returns ONLY supported claims; every result is fully evidence-bound " +
  "and entailed. Safe to present as verified facts.\n" +
  "  annotated — returns all claims with their state; non-supported claims are present but " +
  "labeled — never blended. Use when you need to see the full picture.\n\n" +
  "CITING (mandatory when using this tool's output):\n" +
  "  1. Quote verbatim from evidence[].quote — do NOT paraphrase.\n" +
  "  2. Attribute to the claim's citation field: '(Source: <citation>)'.\n" +
  "  3. Include trace_export_url as the audit link: '[trace](<trace_export_url>)'.\n" +
  "  4. In annotated mode, never present inferred/unverified/contradicted/excluded " +
  "claims as confirmed facts; label them (e.g. 'reportedly', 'unconfirmed', 'disputed').\n\n" +
  "Requires RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY.";

function resolveWorkspaceId(explicit?: string): string | null {
  const id = explicit?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
  return id || null;
}

function resolveProjectId(explicit?: string): string | undefined {
  return explicit?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim() || undefined;
}

function mcpTextResult(structuredContent: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

/**
 * Build a trace export URL from a trace_ref path.
 * trace_ref is typically "/connect/v1/traces/{traceId}".
 * The export route is GET /connect/v1/traces/{traceId}/export.
 */
function buildTraceExportUrl(baseUrl: string, traceRef: string | null | undefined): string | null {
  if (!traceRef || !baseUrl) return null;
  const base = baseUrl.replace(/\/$/, "");
  // If trace_ref is already a full URL, append /export
  if (traceRef.startsWith("http")) {
    return `${traceRef.replace(/\/$/, "")}/export`;
  }
  // trace_ref is a path like "/connect/v1/traces/{traceId}"
  return `${base}${traceRef.replace(/\/$/, "")}/export`;
}

/**
 * Extract VerifiedClaimEnvelope[] from a Connect v1 retrieve response.
 * The v1 response shape (PR #209) carries `verified_claims` at the top level or
 * within `context_pack.claims`, plus `metadata.verification_summary`.
 */
function extractVerifiedClaims(upstream: Record<string, unknown>): VerifiedClaimEnvelope[] {
  // v1: top-level verified_claims array (preferred — Stage 1.1 shape)
  const topLevel = upstream.verified_claims;
  if (Array.isArray(topLevel) && topLevel.length > 0) {
    return topLevel
      .map((raw) => {
        const parsed = VerifiedClaimEnvelopeSchema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      })
      .filter((c): c is VerifiedClaimEnvelope => c !== null);
  }

  // Fallback: context_pack.claims (older shape; degrade gracefully)
  const pack = upstream.context_pack;
  if (pack && typeof pack === "object" && !Array.isArray(pack)) {
    const claims = (pack as Record<string, unknown>).claims;
    if (Array.isArray(claims) && claims.length > 0) {
      return claims
        .map((raw) => {
          const parsed = VerifiedClaimEnvelopeSchema.safeParse(raw);
          return parsed.success ? parsed.data : null;
        })
        .filter((c): c is VerifiedClaimEnvelope => c !== null);
    }
  }

  return [];
}

/**
 * Apply mode filtering:
 *   strict     — keep only "supported" claims
 *   annotated  — keep all, preserving state label
 */
export function applyModeFilter(
  claims: VerifiedClaimEnvelope[],
  mode: "strict" | "annotated",
): VerifiedClaimEnvelope[] {
  if (mode === "strict") {
    return claims.filter((c) => STRICT_ALLOWED.has(c.state as EbvState));
  }
  return claims;
}

/**
 * Compute per-state counts for the verification_summary field.
 */
export function buildVerificationSummary(
  claims: VerifiedClaimEnvelope[],
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const c of claims) {
    summary[c.state] = (summary[c.state] ?? 0) + 1;
  }
  return summary;
}

/**
 * Enrich each claim envelope with a trace_export_url derived from trace_ref + baseUrl.
 */
function enrichWithTraceExportUrl(
  claims: VerifiedClaimEnvelope[],
  baseUrl: string,
): Array<VerifiedClaimEnvelope & { trace_export_url: string | null }> {
  return claims.map((c) => ({
    ...c,
    trace_export_url: buildTraceExportUrl(baseUrl, c.trace_ref),
  }));
}

export function registerConnectVerifiedRetrieval(_server: McpServer, reg: ToolReg): void {
  reg(
    "connect.retrieve_verified",
    {
      description: VERIFIED_RETRIEVAL_TOOL_DESCRIPTION,
      inputSchema: verifiedRetrievalInputSchema,
      outputSchema: verifiedRetrievalOutputSchema,
    },
    async (args) => {
      const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
      const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();

      if (!base || !key) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_HOSTED",
          message:
            "Set RESTORMEL_CONNECT_API_BASE and RESTORMEL_GATEWAY_KEY to call verified retrieval " +
            "(e.g. RESTORMEL_CONNECT_API_BASE=https://restormel.dev).",
        });
      }

      const workspaceId = resolveWorkspaceId(args.workspace_id as string | undefined);
      if (!workspaceId) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_WORKSPACE",
          message: "workspace_id or RESTORMEL_WORKSPACE_ID is required.",
        });
      }

      const mode = ((args.mode as string | undefined) ?? "strict") as "strict" | "annotated";
      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        query: args.query,
        depth: args.depth,
        max_claims: args.max_claims,
        domain_hint: args.domain_hint,
      };
      const projectId = resolveProjectId(args.project_id as string | undefined);
      if (projectId) body.project_id = projectId;

      const proxied = await connectProxyPost({
        baseUrl: base,
        gatewayKey: key,
        path: "/connect/v1/retrieve",
        body,
      });

      if (!proxied.ok) {
        return mcpTextResult(proxied);
      }

      const upstream = proxied.json as Record<string, unknown>;

      // Extract and filter claims
      const allClaims = extractVerifiedClaims(upstream);
      const totalRetrieved = allClaims.length;
      const filtered = applyModeFilter(allClaims, mode);
      const enriched = enrichWithTraceExportUrl(filtered, base);
      const verificationSummary = buildVerificationSummary(allClaims);

      const structuredContent = {
        ok: true,
        tool_version: VERIFIED_RETRIEVAL_TOOL_VERSION,
        mode,
        contract_version: upstream.contract_version as string | undefined,
        request_id: upstream.request_id as string | undefined,
        claims: enriched,
        total_retrieved: totalRetrieved,
        total_after_mode_filter: enriched.length,
        verification_summary: verificationSummary,
        metadata: upstream.metadata,
        upstreamStatus: proxied.status,
      };

      return mcpTextResult(structuredContent);
    },
  );
}
