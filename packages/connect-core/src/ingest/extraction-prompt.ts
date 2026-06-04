/**
 * Compose the extraction prompt from a Domain Pack. This is where the ontology
 * actually steers the LLM: allowed unit/relation types, relationship patterns,
 * and schema_mode are injected so extraction captures complete units AND the
 * relationships between them — not a relationship-less pile of chunks.
 *
 * Used by BOTH the dry-run preview and full execution, so what you preview is
 * what runs.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";

export const EXTRACTION_OUTPUT_CONTRACT = `Return STRICT JSON only (no prose):
{
  "units": [{ "id": "u1", "text": "<one complete unit>", "type": "<unit type or omit>", "domain": "<domain or omit>" }],
  "relations": [{ "from": "u1", "relation": "<relation type>", "to": "u2" }]
}
Each unit id must be unique and referenced by relations. Keep each unit a complete idea, never a fragment.`;

function schemaModeInstruction(mode: "strict" | "guided" | "open"): string {
  switch (mode) {
    case "strict":
      return "STRICT MODE: use ONLY the listed unit types and relation types, and create ONLY relationships that match an allowed pattern. Discard anything that does not fit.";
    case "open":
      return "OPEN MODE: the listed types are examples — discover the unit and relation types that best fit this corpus.";
    default:
      return "GUIDED MODE: prefer the listed unit and relation types; introduce a new type only when clearly necessary.";
  }
}

/** Build the system prompt that grounds extraction in the pack's ontology. */
export function buildExtractionSystemPrompt(pack: ConnectDomainPack): string {
  const o = pack.ontology;
  const parts: string[] = [];

  if (pack.prompts?.extraction?.trim()) {
    parts.push(pack.prompts.extraction.trim());
  } else {
    parts.push(
      `You build a knowledge graph from text for the domain "${pack.title}". Extract atomic ${o.unit_noun}s — each a complete idea — and identify how they relate.`,
    );
  }

  if (o.unit_types.length) {
    parts.push(`Unit types (${o.unit_noun}): ${o.unit_types.join(", ")}.`);
  }
  if (o.domains.length) {
    parts.push(`Classify each unit into one domain from: ${o.domains.join(", ")} (omit if none fit).`);
  }
  if (o.relation_types.length) {
    const rels = o.relation_types
      .map((r) => (r.description ? `${r.name} (${r.description})` : r.name))
      .join("; ");
    parts.push(`Relation types: ${rels}.`);
  }
  if (o.relationship_patterns.length) {
    const pats = o.relationship_patterns
      .map((p) => `${p.from_unit_type} -${p.relation}-> ${p.to_unit_type}`)
      .join("; ");
    parts.push(
      `Allowed relationship patterns (from_type -relation-> to_type): ${pats}.` +
        (o.schema_mode === "strict" ? " Only create relationships that match one of these patterns." : ""),
    );
  }
  parts.push(schemaModeInstruction(o.schema_mode));
  parts.push(
    "Prefer quality over quantity: extract distinct, high-signal ideas only. Avoid near-duplicates and trivial restatements. Typical passages yield roughly 5–20 units unless the text is exceptionally dense.",
  );
  parts.push(EXTRACTION_OUTPUT_CONTRACT);
  return parts.join("\n\n");
}

export function buildExtractionUserPrompt(text: string): string {
  return `Extract units and relationships from the following text:\n\n${text}`;
}
