import { z } from "zod";
import {
  ExtractedClaimSchema,
  ExtractedRelationSchema,
  ExtractionResultSchema,
  type ExtractionResult,
  type VerificationRequest,
} from "@restormel/contracts/verification";
import type { ReasoningCoreContext } from "./context.js";
import { extractStructuredMetaBlock } from "./meta-block.js";
import {
  buildVerificationExtractionUserPrompt,
  VERIFICATION_EXTRACTION_SYSTEM_PROMPT,
} from "./prompts/verification-extraction.js";

const ExtractionMetaBlockSchema = z.object({
  claims: z.array(ExtractedClaimSchema).default([]),
  relations: z.array(ExtractedRelationSchema).default([]),
});

const MAX_RETRIES = 2;

function getSourceText(request: VerificationRequest): string {
  return [request.question, request.answer, request.text].filter(Boolean).join("\n\n");
}

export async function extractClaims(
  request: VerificationRequest,
  ctx: ReasoningCoreContext,
  options?: { providerApiKeys?: unknown }
): Promise<ExtractionResult> {
  const startedAt = Date.now();
  const sourceText = getSourceText(request);

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const extractionRoute = await ctx.resolveExtractionRoute({
        providerApiKeys: options?.providerApiKeys,
        failureMode: "error",
      });
      const result = await ctx.generateText({
        model: extractionRoute.model,
        system: VERIFICATION_EXTRACTION_SYSTEM_PROMPT,
        prompt: buildVerificationExtractionUserPrompt(request),
        maxOutputTokens: 2048,
      });

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      ctx.trackTokens?.(inputTokens, outputTokens);

      const { metaBlock } = extractStructuredMetaBlock(result.text, ExtractionMetaBlockSchema);
      if (!metaBlock) {
        throw new Error("Missing or invalid sophia-meta block in extraction output");
      }

      const candidate: ExtractionResult = {
        claims: metaBlock.claims,
        relations: metaBlock.relations,
        metadata: {
          source_length: sourceText.length,
          extraction_model: extractionRoute.modelId,
          extraction_duration_ms: Date.now() - startedAt,
          tokens_used: {
            input: inputTokens,
            output: outputTokens,
          },
        },
      };

      return ExtractionResultSchema.parse(candidate);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        break;
      }
    }
  }

  throw new Error(
    `Claim extraction failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
