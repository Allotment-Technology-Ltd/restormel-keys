/**
 * Client-side SSE reader for the Proof comparison stream. Pattern adapted from the
 * sophia dialogue store: `response.body.getReader()` + `TextDecoder` + split on blank
 * lines + `data:` JSON parse. Dispatches typed callbacks and resolves with the final text.
 */
import type {
  ComparisonPanelMode,
  ComparisonStreamEvent,
  RetrievalSummary,
} from "./graph-comparison-types";

export type StreamComparisonArgs = {
  proveBase: string;
  mode: ComparisonPanelMode;
  question: string;
  routeId?: string;
  seedNodeIds?: string[];
  signal?: AbortSignal;
  onModel?: (model: { provider: string; model: string }) => void;
  onRetrieval?: (summary: RetrievalSummary) => void;
  onTrace?: (trace: { traceId: string; exportUrl: string }) => void;
  onDelta?: (text: string) => void;
};

export class ComparisonStreamError extends Error {}

export async function streamComparison(
  args: StreamComparisonArgs,
): Promise<{ text: string; retrieval?: RetrievalSummary; traceExportUrl?: string }> {
  const res = await fetch(`${args.proveBase}/api/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: args.mode,
      question: args.question,
      routeId: args.routeId,
      seedNodeIds: args.seedNodeIds,
    }),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    throw new ComparisonStreamError(
      res.status === 401 ? "Your session expired — sign in again." : `Request failed (${res.status}).`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let retrieval: RetrievalSummary | undefined;
  let traceExportUrl: string | undefined;

  const handle = (event: ComparisonStreamEvent): void => {
    switch (event.type) {
      case "model":
        args.onModel?.({ provider: event.provider, model: event.model });
        break;
      case "retrieval":
        retrieval = event.summary;
        args.onRetrieval?.(event.summary);
        break;
      case "trace":
        traceExportUrl = event.exportUrl;
        args.onTrace?.({ traceId: event.traceId, exportUrl: event.exportUrl });
        break;
      case "delta":
        text += event.text;
        args.onDelta?.(event.text);
        break;
      case "complete":
        if (event.text) text = event.text;
        break;
      case "error":
        throw new ComparisonStreamError(event.message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        handle(JSON.parse(payload) as ComparisonStreamEvent);
      }
    }
  }

  return { text, retrieval, traceExportUrl };
}
