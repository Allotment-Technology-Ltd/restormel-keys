/**
 * POST /keys/dashboard/connect/proof/api/stream
 *
 * Streams a single comparison panel (raw OR graph-grounded) as Server-Sent Events.
 * Each panel opens its own request so one failing does not fail the other. All generation
 * runs on the user's BYOK keys via the resolved Keys route — no Restormel LLM cost.
 */
import type { RequestHandler } from "./$types";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import {
  resolveByokChatContext,
  resolveByokChatTarget,
  streamByokChat,
} from "$lib/server/graph-comparison/byok-chat";
import { retrieveStructured } from "$lib/server/graph-comparison/retrieve-structured";
import { toRetrievalSummary } from "$lib/server/graph-comparison/provenance";
import type { ComparisonStreamEvent } from "$lib/connect/graph-comparison-types";

const RAW_SYSTEM = "Answer the following question directly and accurately.";
const GRAPH_SYSTEM =
  "Answer the following question using the provided knowledge context. Cite specific claims from the context to support your answer. Be precise about what the context confirms and what it does not.";

type StreamBody = {
  mode?: "raw" | "graph";
  question?: string;
  routeId?: string;
  seedNodeIds?: string[];
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user || locals.user.authType !== "session") {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: StreamBody;
  try {
    body = (await request.json()) as StreamBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const mode = body.mode === "graph" ? "graph" : "raw";
  const question = body.question?.trim() ?? "";
  if (question.length < 10) {
    return new Response("Question too short", { status: 400 });
  }

  const workspace = await requireConnectWorkspace(locals, () =>
    Promise.resolve({ connectWorkspace: null }),
  );
  if (!workspace) {
    return new Response("Workspace not found", { status: 404 });
  }

  const userId = locals.user.uid;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ComparisonStreamEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        const ctx = await resolveByokChatContext({ workspaceId: workspace.id, userId });
        if (!ctx) {
          send({
            type: "error",
            message: "No model route is configured. Add an Ingest route before testing your graph.",
          });
          return close();
        }

        const targetOutcome = await resolveByokChatTarget({ ctx, routeId: body.routeId });
        if (!targetOutcome.ok) {
          send({ type: "error", message: targetOutcome.error });
          return close();
        }
        const target = targetOutcome.target;
        send({ type: "model", provider: target.providerType, model: target.modelId });

        let system = RAW_SYSTEM;
        let userMessage = question;

        if (mode === "graph") {
          const retrieval = await retrieveStructured({
            workspaceId: workspace.id,
            userId,
            projectId: ctx.projectId,
            query: question,
            seedClaimIds: body.seedNodeIds,
            maxClaims: 24,
          });
          send({ type: "retrieval", summary: toRetrievalSummary(retrieval.result) });
          system = GRAPH_SYSTEM;
          userMessage = retrieval.contextBlock
            ? `${question}\n\nKNOWLEDGE CONTEXT:\n${retrieval.contextBlock}`
            : `${question}\n\nKNOWLEDGE CONTEXT:\n(no verified claims were retrieved for this question)`;
        }

        let full = "";
        for await (const delta of streamByokChat({
          target,
          system,
          user: userMessage,
          signal: request.signal,
        })) {
          full += delta;
          send({ type: "delta", text: delta });
        }
        send({ type: "complete", text: full });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Generation failed.",
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
};
