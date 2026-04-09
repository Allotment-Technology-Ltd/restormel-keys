import { RunTraceSchema, type RunTrace } from "@restormel/contracts";
import { normalizeRunTrace } from "@restormel/observability";
import {
  projectWorkingMemory,
  type MemoryPolicy,
  type StateEvent,
} from "@restormel/state";
import { loadConfigFromString, type ConfigStringFormat } from "@restormel/testing-config";
import { resolveCanonicalDoc, type CanonicalDocTopic } from "./canonical-docs.js";

export type SuiteError = { ok: false; code: string; message: string };

const MAX_CONFIG_CHARS = 512_000;
const MAX_TRACE_CHARS = 2_000_000;
const MAX_GRAPH_JSON_CHARS = 2_000_000;
const MAX_STATE_JSON_CHARS = 1_000_000;

export function suiteResolveCanonical(topic: string) {
  return resolveCanonicalDoc(topic);
}

export function suiteValidateTestingConfig(content: string, format: ConfigStringFormat): SuiteError | { ok: true; valid: true } | { ok: true; valid: false; errors: { path: string; code: string; message: string }[] } {
  if (content.length > MAX_CONFIG_CHARS) {
    return { ok: false, code: "RST_SUITE_INPUT_TOO_LARGE", message: `Config exceeds max length (${MAX_CONFIG_CHARS} chars).` };
  }
  const result = loadConfigFromString(content, format);
  if (result.ok) {
    return { ok: true, valid: true };
  }
  return {
    ok: true,
    valid: false,
    errors: result.errors.map((e) => ({ path: e.path, code: e.code, message: e.message })),
  };
}

export function suiteSummarizeTrace(traceJson: string): SuiteError | { ok: true; summary: string; traceId: string; eventCount: number; spanCount: number; errorEventCount: number } {
  if (traceJson.length > MAX_TRACE_CHARS) {
    return { ok: false, code: "RST_SUITE_INPUT_TOO_LARGE", message: `Trace JSON exceeds max length (${MAX_TRACE_CHARS} chars).` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(traceJson) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "RST_SUITE_TRACE_PARSE", message: `Invalid JSON: ${msg}` };
  }
  const parsedTrace = RunTraceSchema.safeParse(parsed);
  if (!parsedTrace.success) {
    return {
      ok: false,
      code: "RST_SUITE_TRACE_SHAPE",
      message: parsedTrace.error.issues.map((i) => i.message).join("; ") || "RunTrace validation failed.",
    };
  }
  const normalized = normalizeRunTrace(parsedTrace.data as unknown as RunTrace);
  const errorEventCount = normalized.events.filter((ev) => ev.status === "error").length;
  const summary = `traceId=${normalized.traceId} events=${normalized.events.length} spans=${normalized.spans.length} errorEvents=${errorEventCount} source=${normalized.source}`;
  return {
    ok: true,
    summary,
    traceId: normalized.traceId,
    eventCount: normalized.events.length,
    spanCount: normalized.spans.length,
    errorEventCount,
  };
}

/** Minimal Contract v0 GraphData structural check (no deep node validation). */
export function suiteValidateGraphFixture(json: string): SuiteError | { ok: true; nodeCount: number; edgeCount: number; ghostNodeCount: number; ghostEdgeCount: number } {
  if (json.length > MAX_GRAPH_JSON_CHARS) {
    return { ok: false, code: "RST_SUITE_INPUT_TOO_LARGE", message: `JSON exceeds max length (${MAX_GRAPH_JSON_CHARS} chars).` };
  }
  let data: unknown;
  try {
    data = JSON.parse(json) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "RST_SUITE_GRAPH_PARSE", message: `Invalid JSON: ${msg}` };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, code: "RST_SUITE_GRAPH_SHAPE", message: "Root must be an object." };
  }
  const o = data as Record<string, unknown>;
  for (const key of ["nodes", "edges", "ghostNodes", "ghostEdges"] as const) {
    if (!Array.isArray(o[key])) {
      return { ok: false, code: "RST_SUITE_GRAPH_SHAPE", message: `Missing or non-array "${key}".` };
    }
  }
  return {
    ok: true,
    nodeCount: (o.nodes as unknown[]).length,
    edgeCount: (o.edges as unknown[]).length,
    ghostNodeCount: (o.ghostNodes as unknown[]).length,
    ghostEdgeCount: (o.ghostEdges as unknown[]).length,
  };
}

const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
  maxCellsPerScope: 100,
  maxApproxTokensPerScope: 32_000,
};

export function suiteMemoryPreview(
  eventsJson: string,
  policy?: Partial<MemoryPolicy>,
): SuiteError | { ok: true; last_sequence: number; applied_event_count: number; scope_ids: string[]; scope_cell_counts: Record<string, number>; cells_preview: { scope: string; id: string; approx_tokens: number; pinned: boolean; textLength: number }[] } {
  if (eventsJson.length > MAX_STATE_JSON_CHARS) {
    return { ok: false, code: "RST_SUITE_INPUT_TOO_LARGE", message: `JSON exceeds max length (${MAX_STATE_JSON_CHARS} chars).` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(eventsJson) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "RST_SUITE_STATE_PARSE", message: `Invalid JSON: ${msg}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, code: "RST_SUITE_STATE_SHAPE", message: "Root must be an array of StateEvent objects." };
  }
  const events = parsed as StateEvent[];
  const memPolicy: MemoryPolicy = {
    maxCellsPerScope: policy?.maxCellsPerScope ?? DEFAULT_MEMORY_POLICY.maxCellsPerScope,
    maxApproxTokensPerScope: policy?.maxApproxTokensPerScope ?? DEFAULT_MEMORY_POLICY.maxApproxTokensPerScope,
  };
  try {
    const view = projectWorkingMemory(events, memPolicy);
    const scope_ids = Object.keys(view.scopes).sort();
    const scope_cell_counts: Record<string, number> = {};
    for (const s of scope_ids) {
      scope_cell_counts[s] = view.scopes[s]?.length ?? 0;
    }
    const cells_preview: { scope: string; id: string; approx_tokens: number; pinned: boolean; textLength: number }[] = [];
    for (const s of scope_ids) {
      for (const c of view.scopes[s] ?? []) {
        cells_preview.push({
          scope: c.scope,
          id: c.id,
          approx_tokens: c.approx_tokens,
          pinned: c.pinned,
          textLength: c.text.length,
        });
      }
    }
    return {
      ok: true,
      last_sequence: view.last_sequence,
      applied_event_count: view.applied_event_ids.length,
      scope_ids,
      scope_cell_counts,
      cells_preview,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "RST_SUITE_STATE_PROJECT", message: msg };
  }
}
