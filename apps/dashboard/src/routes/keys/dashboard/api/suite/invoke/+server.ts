import {
  RESTORMEL_SUITE_TOOL_NAMES,
  suiteMemoryPreview,
  suiteResolveCanonical,
  suiteSummarizeTrace,
  suiteValidateGraphFixture,
  suiteValidateTestingConfig,
} from "@restormel/mcp";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

type SuiteTool = (typeof RESTORMEL_SUITE_TOOL_NAMES)[number];

function isSuiteTool(s: string): s is SuiteTool {
  return (RESTORMEL_SUITE_TOOL_NAMES as readonly string[]).includes(s);
}

function badRequest(code: string, message: string) {
  return json({ ok: false, code, message }, { status: 400 });
}

/**
 * HTTP mirror of Horizon suite MCP read tools (consumer key via Zuplo → injected Gateway key).
 * Same result shapes as stdio `structuredContent`; use 400 only for envelope/payload errors.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("RST_SUITE_HTTP_JSON", "Request body must be JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("RST_SUITE_HTTP_BODY", "Body must be an object with tool and optional payload.");
  }
  const o = body as Record<string, unknown>;
  const tool = o.tool;
  const payload = o.payload;

  if (typeof tool !== "string" || !isSuiteTool(tool)) {
    return badRequest(
      "RST_SUITE_UNKNOWN_TOOL",
      `Unknown or missing tool. Valid: ${RESTORMEL_SUITE_TOOL_NAMES.join(", ")}.`,
    );
  }
  if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
    return badRequest("RST_SUITE_HTTP_PAYLOAD", "payload must be a plain object when present.");
  }
  const p = (payload ?? {}) as Record<string, unknown>;

  switch (tool) {
    case "docs.canonical_resolve": {
      if (typeof p.topic !== "string") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.topic (string) is required.");
      }
      const r = suiteResolveCanonical(p.topic);
      if (!r.ok) return json(r);
      return json({
        ok: true,
        topic: r.entry.topic,
        title: r.entry.title,
        repoPath: r.entry.repoPath,
        publicUrl: r.entry.publicUrl,
      });
    }
    case "testing.config_validate": {
      if (typeof p.content !== "string") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.content (string) is required.");
      }
      if (p.format !== "yaml" && p.format !== "json") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.format must be \"yaml\" or \"json\".");
      }
      const r = suiteValidateTestingConfig(p.content, p.format);
      if (!r.ok) return json(r);
      if (r.valid) return json({ ok: true, valid: true });
      return json({ ok: true, valid: false, errors: r.errors });
    }
    case "observability.trace_summarize": {
      if (typeof p.traceJson !== "string") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.traceJson (string) is required.");
      }
      const r = suiteSummarizeTrace(p.traceJson);
      if (!r.ok) return json(r);
      return json({
        ok: true,
        summary: r.summary,
        traceId: r.traceId,
        eventCount: r.eventCount,
        spanCount: r.spanCount,
        errorEventCount: r.errorEventCount,
      });
    }
    case "graph.fixture_validate": {
      if (typeof p.graphJson !== "string") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.graphJson (string) is required.");
      }
      const r = suiteValidateGraphFixture(p.graphJson);
      if (!r.ok) return json(r);
      return json({
        ok: true,
        nodeCount: r.nodeCount,
        edgeCount: r.edgeCount,
        ghostNodeCount: r.ghostNodeCount,
        ghostEdgeCount: r.ghostEdgeCount,
      });
    }
    case "state.memory_preview": {
      if (typeof p.eventsJson !== "string") {
        return badRequest("RST_SUITE_HTTP_ARG", "payload.eventsJson (string) is required.");
      }
      const maxCellsPerScope =
        typeof p.maxCellsPerScope === "number" && Number.isInteger(p.maxCellsPerScope) && p.maxCellsPerScope > 0
          ? p.maxCellsPerScope
          : undefined;
      const maxApproxTokensPerScope =
        typeof p.maxApproxTokensPerScope === "number" &&
        Number.isInteger(p.maxApproxTokensPerScope) &&
        p.maxApproxTokensPerScope > 0
          ? p.maxApproxTokensPerScope
          : undefined;
      const r = suiteMemoryPreview(p.eventsJson, { maxCellsPerScope, maxApproxTokensPerScope });
      if (!r.ok) return json(r);
      return json({
        ok: true,
        last_sequence: r.last_sequence,
        applied_event_count: r.applied_event_count,
        scope_ids: r.scope_ids,
        scope_cell_counts: r.scope_cell_counts,
        cells_preview: r.cells_preview,
      });
    }
  }

  return json({ ok: false, code: "RST_SUITE_INTERNAL", message: "Unhandled suite tool." }, { status: 500 });
};
