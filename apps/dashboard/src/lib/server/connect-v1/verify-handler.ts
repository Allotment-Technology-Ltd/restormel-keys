/**
 * POST /connect/v1/verify — Knowledge Verify (Phase 6).
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  ConnectVerifyRequestSchema,
  type ConnectVerifyResponse,
} from "@restormel/contracts/connect";
import { runVerificationPipeline } from "@restormel/reasoning-core";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { createDashboardReasoningContext, probeDashboardVerifyReadiness } from "./reasoning-context.js";

export type ConnectVerifyHandlerOutcome =
  | { ok: true; status: 200; body: ConnectVerifyResponse; requestId: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleKnowledgeVerify(args: {
  locals: App.Locals;
  body: unknown;
  requestId: string;
}): Promise<ConnectVerifyHandlerOutcome> {
  const parsed = ConnectVerifyRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: parsed.data.workspace_id,
    projectId: parsed.data.project_id,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  const readiness = await probeDashboardVerifyReadiness({
    projectId: auth.projectId,
    userId: auth.userId,
    environmentId: parsed.data.environment_id,
  });
  if (!readiness.ok) {
    return {
      ok: false,
      status: 503,
      body: {
        error: readiness.code,
        message: readiness.message,
        hint: "Configure a published verification route and provider credentials in Restormel Dashboard.",
      },
    };
  }

  try {
    const ctx = createDashboardReasoningContext({
      projectId: auth.projectId,
      userId: auth.userId,
      environmentId: parsed.data.environment_id,
    });
    const pipeline = await runVerificationPipeline(parsed.data.verify, {
      ctx,
      includePassOutputs: false,
    });

    const response: ConnectVerifyResponse = {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      request_id: args.requestId,
      result: {
        request_id: args.requestId,
        extracted_claims: pipeline.extracted_claims,
        logical_relations: pipeline.logical_relations,
        reasoning_quality: pipeline.reasoning_quality,
        constitutional_check: pipeline.constitutional_check,
        metadata: {
          processing_time_ms: 0,
          input_length: pipeline.inputText.length,
          model: pipeline.reasoning_model?.modelId ?? "unknown",
          tokens_used: {
            extraction_input: pipeline.extraction_input_tokens,
            extraction_output: pipeline.extraction_output_tokens,
          },
        },
      },
    };

    return { ok: true, status: 200, body: response, requestId: args.requestId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 502,
      body: { error: "verify_failed", message: message.slice(0, 500) },
    };
  }
}
