/**
 * Connect MCP tool helpers — validate payloads and optionally proxy to hosted REST.
 */
import {
  ConnectIngestJobCreateRequestSchema,
  ConnectRetrieveRequestSchema,
  ConnectVerifyRequestSchema,
} from "@restormel/contracts/connect";

export type ConnectToolError = { ok: false; code: string; message: string };

function parseJson(input: string): unknown | ConnectToolError {
  try {
    return JSON.parse(input) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "RST_CONNECT_JSON", message: `Invalid JSON: ${msg}` };
  }
}

export async function connectValidateVerifyRequest(requestJson: string) {
  if (requestJson.length > 512_000) {
    return {
      ok: false as const,
      code: "RST_CONNECT_INPUT_TOO_LARGE",
      message: "Request JSON exceeds max length.",
    };
  }
  const parsed = parseJson(requestJson);
  if (parsed && typeof parsed === "object" && "ok" in parsed && parsed.ok === false) {
    return parsed as ConnectToolError;
  }
  const result = ConnectVerifyRequestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false as const,
      code: "RST_CONNECT_VERIFY_SHAPE",
      message: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true as const, validated: true, stage: "verify" as const };
}

export async function connectValidateRetrieveRequest(requestJson: string) {
  if (requestJson.length > 256_000) {
    return {
      ok: false as const,
      code: "RST_CONNECT_INPUT_TOO_LARGE",
      message: "Request JSON exceeds max length.",
    };
  }
  const parsed = parseJson(requestJson);
  if (parsed && typeof parsed === "object" && "ok" in parsed && parsed.ok === false) {
    return parsed as ConnectToolError;
  }
  const result = ConnectRetrieveRequestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false as const,
      code: "RST_CONNECT_RETRIEVE_SHAPE",
      message: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true as const, validated: true, stage: "retrieve" as const };
}

export async function connectValidateIngestStartRequest(requestJson: string) {
  if (requestJson.length > 512_000) {
    return {
      ok: false as const,
      code: "RST_CONNECT_INPUT_TOO_LARGE",
      message: "Request JSON exceeds max length.",
    };
  }
  const parsed = parseJson(requestJson);
  if (parsed && typeof parsed === "object" && "ok" in parsed && parsed.ok === false) {
    return parsed as ConnectToolError;
  }
  const result = ConnectIngestJobCreateRequestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false as const,
      code: "RST_CONNECT_INGEST_SHAPE",
      message: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return {
    ok: true as const,
    validated: true,
    stage: "ingest_start" as const,
    note: "Execution requires POST /connect/v1/ingest/jobs (workspace-scoped job persistence).",
  };
}

export function connectIngestStatusHint(jobId: string) {
  const id = jobId.trim();
  if (!id) {
    return { ok: false as const, code: "RST_CONNECT_JOB_ID", message: "jobId is required." };
  }
  return {
    ok: true as const,
    validated: true,
    jobId: id,
    note: "Execution requires GET /connect/v1/ingest/jobs/{jobId} (workspace-scoped job status).",
  };
}

export async function connectProxyPost(args: {
  baseUrl: string;
  gatewayKey: string;
  path: string;
  body: unknown;
}): Promise<{ ok: true; status: number; json: unknown } | ConnectToolError> {
  const base = args.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}${args.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.gatewayKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.body),
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "RST_CONNECT_UPSTREAM", message: `Upstream returned non-JSON (${res.status})` };
  }
  return { ok: true, status: res.status, json };
}

export async function connectProxyGet(args: {
  baseUrl: string;
  gatewayKey: string;
  path: string;
  query?: Record<string, string>;
}): Promise<{ ok: true; status: number; json: unknown } | ConnectToolError> {
  const base = args.baseUrl.replace(/\/$/, "");
  const qs = args.query ? new URLSearchParams(args.query).toString() : "";
  const url = qs ? `${base}${args.path}?${qs}` : `${base}${args.path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${args.gatewayKey}` },
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "RST_CONNECT_UPSTREAM", message: `Upstream returned non-JSON (${res.status})` };
  }
  return { ok: true, status: res.status, json };
}
