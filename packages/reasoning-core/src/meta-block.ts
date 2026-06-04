import type { z } from "zod";

const DEFAULT_FENCE = "sophia-meta";

/**
 * Extract JSON from a fenced meta block (default: ```sophia-meta).
 * Keeps fence name for prompt compatibility with existing model outputs.
 */
export function extractStructuredMetaBlock<T extends z.ZodTypeAny>(
  text: string,
  schema: T,
  fenceName: string = DEFAULT_FENCE
): { cleanedText: string; metaBlock: z.infer<T> | null } {
  const pattern = new RegExp("```" + fenceName + "\\n?([\\s\\S]*?)\\n?```");
  const metaMatch = text.match(pattern);
  if (!metaMatch) {
    return { cleanedText: text, metaBlock: null };
  }

  try {
    const metaJson = JSON.parse(metaMatch[1]) as unknown;
    const validated = schema.safeParse(metaJson);
    if (!validated.success) {
      return { cleanedText: text, metaBlock: null };
    }
    const cleanedText = text.replace(pattern, "").trim();
    return { cleanedText, metaBlock: validated.data as z.infer<T> };
  } catch {
    return { cleanedText: text, metaBlock: null };
  }
}
