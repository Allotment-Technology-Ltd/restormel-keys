/**
 * Use-case prompt template library — archetype defaults for each pipeline stage.
 * Version bumps when automated feedback loop adjusts calibration (Phase 6).
 */
export const PROMPT_TEMPLATE_VERSION = 1;

export type PackArchetype =
  | "argumentative"
  | "factual"
  | "procedural"
  | "product_docs"
  | "generic";

export type IngestPromptStage =
  | "extraction"
  | "relations"
  | "grouping"
  | "validation"
  | "remediation";

const STAGE_INTROS: Record<PackArchetype, Record<IngestPromptStage, string>> = {
  argumentative: {
    extraction:
      'You build a knowledge graph from argumentative discourse for "{pack_title}". Extract complete {unit_noun}s (premises, conclusions, objections) and the discourse relations between them — not isolated fragments.',
    relations:
      "Identify discourse relations between {unit_noun}s in argumentative text for \"{pack_title}\". Focus on supports, contradicts, responds_to, and qualifies.",
    grouping:
      'Group related {unit_noun}s into coherent {group_noun}s (e.g. a complete argument or debate thread) for "{pack_title}".',
    validation:
      'You validate extracted {unit_noun}s from argumentative sources for "{pack_title}". Flag only clear hallucinations or misreadings — faithful paraphrase of premises and conclusions is "ok".',
    remediation:
      'Repair weak {unit_noun}s from argumentative text for "{pack_title}" so they remain faithful to the source, or drop unsupported ones.',
  },
  factual: {
    extraction:
      'You build a reference knowledge graph for "{pack_title}". Extract precise {unit_noun}s (definitions, facts, citations) with minimal inference beyond the text.',
    relations:
      "Identify factual relations (supports, depends_on, defines) between {unit_noun}s for \"{pack_title}\".",
    grouping:
      'Cluster related {unit_noun}s into topical {group_noun}s for "{pack_title}".',
    validation:
      'Validate {unit_noun}s for factual faithfulness to the source for "{pack_title}". Be strict on invented facts; allow concise paraphrase of stated facts.',
    remediation:
      'Correct or drop {unit_noun}s that add facts not in the source for "{pack_title}".',
  },
  procedural: {
    extraction:
      'You extract procedural knowledge from "{pack_title}". Capture steps, obligations, conditions, and version qualifiers as complete {unit_noun}s.',
    relations:
      "Identify procedural dependencies (depends_on, precedes, qualifies) between {unit_noun}s for \"{pack_title}\".",
    grouping:
      'Group {unit_noun}s into procedure or policy {group_noun}s for "{pack_title}".',
    validation:
      'Validate procedural {unit_noun}s against the source for "{pack_title}". Flag missing qualifiers and scope creep.',
    remediation:
      'Repair procedural {unit_noun}s to match source obligations and scope for "{pack_title}", or drop.',
  },
  product_docs: {
    extraction:
      'You extract product and API knowledge for "{pack_title}". Capture requirements, constraints, behaviours, and cross-references as {unit_noun}s.',
    relations:
      "Identify product relations (depends_on, relates_to, contradicts) between {unit_noun}s for \"{pack_title}\".",
    grouping:
      'Group {unit_noun}s into feature or topic {group_noun}s for "{pack_title}".',
    validation:
      'Validate {unit_noun}s against technical documentation for "{pack_title}". Unsupported API claims are "unsupported".',
    remediation:
      'Align weak {unit_noun}s with documented behaviour for "{pack_title}", or drop.',
  },
  generic: {
    extraction:
      'You build a knowledge graph from text for "{pack_title}". Extract atomic {unit_noun}s — each a complete idea — and identify how they relate.',
    relations:
      "Identify relations between {unit_noun}s for \"{pack_title}\" using the pack vocabulary.",
    grouping:
      'Group related {unit_noun}s into {group_noun}s for "{pack_title}". Each group is a coherent whole, not an arbitrary bucket.',
    validation:
      'You validate extracted {unit_noun}s for "{pack_title}". Catch hallucinations and serious misreadings — not faithful paraphrases.',
    remediation:
      'Repair {unit_noun}s flagged as weak or unsupported for "{pack_title}", or drop those that cannot be supported.',
  },
};

export function getArchetypeStageIntro(archetype: PackArchetype, stage: IngestPromptStage): string {
  return STAGE_INTROS[archetype][stage];
}

/** Slug → archetype until pack.archetype is set explicitly. */
export function inferArchetypeFromSlug(slug: string): PackArchetype {
  if (slug === "philosophy") return "argumentative";
  if (slug === "generic") return "generic";
  if (/policy|sop|procedure|runbook|compliance/i.test(slug)) return "procedural";
  if (/api|docs|product|spec|guide/i.test(slug)) return "product_docs";
  if (/wiki|encyclopedia|reference|textbook|factual/i.test(slug)) return "factual";
  return "generic";
}
