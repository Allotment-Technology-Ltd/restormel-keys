import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { searchRestormelDocumentation } from "./grounding.js";
import { RESTORMEL_SUPPORT_SYSTEM } from "./prompt.js";

export type SupportStreamOptions = {
  messages: ModelMessage[];
  openaiApiKey: string;
  model?: string;
};

/**
 * Stream a support chat completion (plain text stream) with doc-search tool calls.
 * Host is responsible for auth and rate limits.
 */
export function supportChatToTextStreamResponse(options: SupportStreamOptions): Response {
  const openai = createOpenAI({ apiKey: options.openaiApiKey });
  const modelId = options.model?.trim() || "gpt-4o-mini";

  const result = streamText({
    model: openai(modelId),
    system: RESTORMEL_SUPPORT_SYSTEM,
    messages: options.messages,
    tools: {
      searchRestormelDocs: tool({
        description:
          "Search the Restormel documentation index (offline). Returns titles and URLs on restormel.dev. Use before answering how-to or navigation questions.",
        inputSchema: z.object({
          query: z.string().describe("What to look for"),
          section: z.string().optional().describe("Optional section id, e.g. mcp, integrations"),
        }),
        execute: async ({ query, section }) => {
          const hits = searchRestormelDocumentation(query, section, 8);
          return hits.map((h) => ({
            title: h.title,
            url: h.url,
            hints: h.keywords.slice(0, 5),
          }));
        },
      }),
    },
    stopWhen: stepCountIs(6),
  });

  return result.toTextStreamResponse();
}
