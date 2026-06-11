/**
 * connect.memory.write — agent memory write tool (Stage 3.4).
 *
 * Pairs with connect.retrieve_verified: that tool reads verified claims out of the
 * workspace knowledge graph; this one submits agent observations INTO it. Every
 * observation runs the same EBV quality gate as document ingest before it is
 * persisted as a claim — nothing reaches retrieval unverified:
 *
 *   - EBV Layer 1: the evidence quote is bound (exact → normalized → bounded fuzzy)
 *     against the submitted evidence context. A quote that does not appear in its own
 *     context does not bind.
 *   - EBV Layer 2: span-scoped entailment with abstention. "supported" requires
 *     bound AND entailed. An observation with NO evidence can never be supported —
 *     it abstains locally and lands unverified (review queue).
 *   - Weak/not-entailed observations go through remediation (repair or soft-exclude);
 *     rejected observations come back with transparent reasons.
 *
 * EVIDENCE for an observation = the exact text the agent saw (`quote`), optionally
 * with the surrounding passage (`context`) and a `source_ref` for audit. It is
 * AGENT-ATTESTED: provenance records kind "agent_observation" + the submitting key id.
 *
 * Auth: RESTORMEL_CONNECT_API_BASE + RESTORMEL_GATEWAY_KEY (Gateway key rk_…).
 * The endpoint is rate-limited per key (HTTP 429 with retry_after_seconds).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  CONNECT_MEMORY_MAX_OBSERVATIONS,
  ConnectMemoryWriteRequestSchema,
} from "@restormel/contracts/connect";
import { connectProxyPost } from "./connect-tools-logic.js";
import type { RestormelSuiteToolName } from "./suite-tool-names.js";

/** Tool schema version — bump when the output shape changes in a breaking way. */
export const MEMORY_WRITE_TOOL_VERSION = "1.0.0";

type ToolReg = (
  name: RestormelSuiteToolName,
  config: { description: string; inputSchema: Record<string, z.ZodType>; outputSchema: Record<string, z.ZodType> },
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; structuredContent: unknown }>,
) => void;

export const memoryWriteInputSchema = {
  observations: z
    .array(
      z.object({
        text: z
          .string()
          .min(1)
          .max(2000)
          .describe("The claim to remember — one factual statement, ≤2000 chars."),
        evidence: z
          .object({
            quote: z
              .string()
              .min(1)
              .max(2000)
              .describe(
                "EXACT verbatim quote supporting the observation (it is bound character-for-character, not paraphrased).",
              ),
            source_ref: z
              .string()
              .min(1)
              .max(500)
              .optional()
              .describe("Where you saw it (URL, document title, tool name…). Audit metadata."),
            context: z
              .string()
              .min(1)
              .max(8000)
              .optional()
              .describe(
                "Surrounding passage the quote appears in; stored verbatim as the bindable source text. The quote MUST appear within it.",
              ),
          })
          .optional()
          .describe(
            "Evidence for the observation. Omitting it means the observation can never be 'supported' — it lands in the review queue.",
          ),
      }),
    )
    .min(1)
    .max(CONNECT_MEMORY_MAX_OBSERVATIONS)
    .describe(`Observations to submit (max ${CONNECT_MEMORY_MAX_OBSERVATIONS} per call — one validation batch).`),
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
};

export const memoryWriteOutputSchema = {
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  tool_version: z.string().optional(),
  contract_version: z.string().optional(),
  request_id: z.string().optional(),
  source_id: z.string().optional(),
  provenance: z
    .object({
      kind: z.literal("agent_observation"),
      key_id: z.string().nullable(),
      auth_type: z.string(),
    })
    .optional(),
  results: z
    .array(
      z.object({
        index: z.number(),
        unit_id: z.string(),
        claim_key: z.string().nullable(),
        text: z.string(),
        verification_state: z.string(),
        evidence_binding: z.string(),
        outcome: z.enum(["accepted", "review", "rejected"]),
        repaired: z.boolean(),
        reasons: z.array(z.string()),
      }),
    )
    .optional(),
  summary: z
    .object({
      supported: z.number(),
      inferred: z.number(),
      unverified: z.number(),
      excluded: z.number(),
      embedded: z.number(),
    })
    .optional(),
  warnings: z.array(z.string()).optional(),
  retry_after_seconds: z.number().optional(),
  upstreamStatus: z.number().optional(),
};

/** Tool description — written so the calling agent submits verifiable observations. */
export const MEMORY_WRITE_TOOL_DESCRIPTION =
  "Write agent observations into a Restormel Connect knowledge graph as verified-memory " +
  "claims (POST /connect/v1/memory). Act tier. Every observation runs the SAME " +
  "evidence-bound validation gate as document ingest before persisting — nothing " +
  "reaches retrieval unverified.\n\n" +
  "EVIDENCE RULES (decide what you submit):\n" +
  "  - evidence.quote must be the EXACT text you saw — it is bound verbatim, never paraphrased.\n" +
  "  - evidence.context (recommended) is the surrounding passage; the quote MUST appear inside it.\n" +
  "  - evidence.source_ref says where you saw it (URL, doc title, tool name) — audit metadata.\n" +
  "  - No evidence ⇒ the observation can NEVER be 'supported'; it is persisted as unverified " +
  "and held for human review (outcome 'review').\n\n" +
  "OUTCOMES (per observation, transparent reasons included):\n" +
  "  accepted — evidence bound AND entailed (supported; inferred is labeled). Reaches verified retrieval.\n" +
  "  review   — unverified (no/unbound evidence, or judge abstained). Held for the review queue.\n" +
  "  rejected — no basis in the submitted evidence; soft-excluded, never retrievable.\n\n" +
  "Provenance is recorded as kind 'agent_observation' with your submitting key id. " +
  `Max ${CONNECT_MEMORY_MAX_OBSERVATIONS} observations per call; the endpoint rate-limits per key (429 + retry_after_seconds). ` +
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

/** Map a non-200 upstream response to a transparent, fail-closed tool error. */
export function memoryWriteUpstreamError(
  status: number,
  upstream: Record<string, unknown>,
): Record<string, unknown> {
  const message =
    (typeof upstream.message === "string" && upstream.message) ||
    (typeof upstream.error === "string" && upstream.error) ||
    `Memory write failed (HTTP ${status}).`;
  const out: Record<string, unknown> = {
    ok: false,
    code:
      status === 429
        ? "RST_CONNECT_RATE_LIMITED"
        : status === 401 || status === 403
          ? "RST_CONNECT_AUTH"
          : "RST_CONNECT_MEMORY_WRITE",
    message,
    upstreamStatus: status,
  };
  if (typeof upstream.retry_after_seconds === "number") {
    out.retry_after_seconds = upstream.retry_after_seconds;
  }
  return out;
}

export function registerConnectMemoryWrite(_server: McpServer, reg: ToolReg): void {
  reg(
    "connect.memory.write",
    {
      description: MEMORY_WRITE_TOOL_DESCRIPTION,
      inputSchema: memoryWriteInputSchema,
      outputSchema: memoryWriteOutputSchema,
    },
    async (args) => {
      const base = process.env.RESTORMEL_CONNECT_API_BASE?.trim();
      const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();

      if (!base || !key) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_HOSTED",
          message:
            "Set RESTORMEL_CONNECT_API_BASE and RESTORMEL_GATEWAY_KEY to write agent memory " +
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

      const body: Record<string, unknown> = {
        workspace_id: workspaceId,
        observations: args.observations,
      };
      const projectId = resolveProjectId(args.project_id as string | undefined);
      if (projectId) body.project_id = projectId;

      // Validate the payload shape before touching the network — same contract the
      // route enforces, so malformed submissions fail fast and locally.
      const parsed = ConnectMemoryWriteRequestSchema.safeParse(body);
      if (!parsed.success) {
        return mcpTextResult({
          ok: false,
          code: "RST_CONNECT_MEMORY_SHAPE",
          message: parsed.error.issues
            .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
            .join("; "),
        });
      }

      const proxied = await connectProxyPost({
        baseUrl: base,
        gatewayKey: key,
        path: "/connect/v1/memory",
        body: parsed.data,
      });
      if (!proxied.ok) {
        return mcpTextResult(proxied);
      }

      const upstream = proxied.json as Record<string, unknown>;
      if (proxied.status !== 200) {
        return mcpTextResult(memoryWriteUpstreamError(proxied.status, upstream));
      }

      return mcpTextResult({
        ok: true,
        tool_version: MEMORY_WRITE_TOOL_VERSION,
        contract_version: upstream.contract_version,
        request_id: upstream.request_id,
        source_id: upstream.source_id,
        provenance: upstream.provenance,
        results: upstream.results,
        summary: upstream.summary,
        ...(Array.isArray(upstream.warnings) ? { warnings: upstream.warnings } : {}),
        upstreamStatus: proxied.status,
      });
    },
  );
}
