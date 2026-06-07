/**
 * Quality-delta analysis: a third BYOK LLM call comparing the raw (A) and graph-grounded
 * (B) responses against the verified claims that were injected as context. Returns the
 * fixed JSON shape the QualityDelta component renders, with a graceful fallback when the
 * model does not return valid JSON.
 */
import type { QualityDelta, QualityVerdict } from "$lib/connect/graph-comparison-types";
import { generateByokJson, type ByokChatTarget } from "./byok-chat";

const SYSTEM_PROMPT = `You are analysing two responses to the same question. Response A was generated without any knowledge graph context. Response B was generated with a verified knowledge graph providing context. Compare them against the verified claims provided.

Return a JSON object with this exact structure:
{
  "additional_specificity": string,   // one sentence: what Response B knows that A does not
  "contradictions": string | null,    // one sentence: any claim in A that the graph contradicts, or null
  "hedging_resolved": string | null,  // one sentence: where A hedged but the graph has a clear answer, or null
  "provenance_count": number,         // how many verified claims Response B drew on
  "verdict": "significant" | "moderate" | "minimal"  // overall difference magnitude
}

Be concise. Each string field is one sentence maximum. Do not editorialize.`;

const VERDICTS: QualityVerdict[] = ["significant", "moderate", "minimal"];

export type AnalyseQualityDeltaInput = {
  target: ByokChatTarget;
  question: string;
  responseA: string;
  responseB: string;
  claims: string[];
  signal?: AbortSignal;
};

export async function analyseQualityDelta(
  input: AnalyseQualityDeltaInput,
): Promise<QualityDelta> {
  const claimsBlock =
    input.claims.length > 0
      ? input.claims.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : "(none)";
  const user = [
    `QUESTION:\n${input.question}`,
    `RESPONSE A (no knowledge graph):\n${input.responseA || "(empty)"}`,
    `RESPONSE B (with knowledge graph):\n${input.responseB || "(empty)"}`,
    `VERIFIED CLAIMS INJECTED INTO RESPONSE B:\n${claimsBlock}`,
  ].join("\n\n");

  const outcome = await generateByokJson({
    target: input.target,
    system: SYSTEM_PROMPT,
    user,
    signal: input.signal,
  });

  if (!outcome.ok) return fallbackDelta(input.claims.length);
  return parseQualityDelta(outcome.content, input.claims.length);
}

/** Parse model JSON into a QualityDelta, coercing/validating each field. Exported for tests. */
export function parseQualityDelta(raw: string, claimCount: number): QualityDelta {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return fallbackDelta(claimCount);
  }
  if (!parsed || typeof parsed !== "object") return fallbackDelta(claimCount);

  const verdict = VERDICTS.includes(parsed.verdict as QualityVerdict)
    ? (parsed.verdict as QualityVerdict)
    : "moderate";

  const provenanceCount =
    typeof parsed.provenance_count === "number" && Number.isFinite(parsed.provenance_count)
      ? Math.max(0, Math.round(parsed.provenance_count))
      : claimCount;

  return {
    additional_specificity: oneSentence(parsed.additional_specificity) ?? "No additional specificity detected.",
    contradictions: oneSentence(parsed.contradictions),
    hedging_resolved: oneSentence(parsed.hedging_resolved),
    provenance_count: provenanceCount,
    verdict,
  };
}

function oneSentence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "none") return null;
  return trimmed;
}

function fallbackDelta(claimCount: number): QualityDelta {
  return {
    additional_specificity:
      claimCount > 0
        ? "The graph response drew on verified claims from your documents that the base model could not cite."
        : "Comparison analysis was unavailable for this question.",
    contradictions: null,
    hedging_resolved: null,
    provenance_count: claimCount,
    verdict: claimCount > 0 ? "moderate" : "minimal",
  };
}
