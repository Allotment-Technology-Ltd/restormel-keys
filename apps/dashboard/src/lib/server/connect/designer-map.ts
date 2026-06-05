/**
 * Pure mapper: turn the Graph Designer LLM's JSON proposal into a validated
 * ConnectDomainPackUpsert draft. No network/DB imports so it is unit-testable.
 *
 * The LLM proposes the ontology (unit/group nouns, taxonomy, unit/relation/role
 * types, relationship patterns, schema mode); we derive a consistent graph schema
 * and fill sensible defaults for parsing/chunking/embedding.
 */
import {
  DEFAULT_GENERIC_DOMAIN_PACK,
  ConnectDomainPackUpsertSchema,
  type ConnectDomainPackUpsert,
  type ConnectPackArchetype,
} from "@restormel/contracts/connect";
import { inferArchetypeFromSlug } from "@restormel/connect-core";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asStringArray(v: unknown, max = 100): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = typeof item === "string" ? item.trim() : "";
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function slugify(input: string, fallback = "custom"): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || fallback;
}

/** Postgres/Surreal-safe table/edge identifier. */
function identifier(input: string, fallback: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return /^[a-z_]/.test(s) ? s : fallback;
}

type DesignerResult = { draft: ConnectDomainPackUpsert; rationale?: string };

/**
 * Map the (possibly messy) LLM JSON into a validated draft. Throws if the result
 * cannot satisfy the contract even after defaulting.
 */
export function buildDomainPackDraft(input: unknown, opts?: { fallbackTitle?: string }): DesignerResult {
  const obj = (input && typeof input === "object" ? (input as Record<string, unknown>) : {}) ?? {};
  const gen = DEFAULT_GENERIC_DOMAIN_PACK;

  const title = asString(obj.title, opts?.fallbackTitle ?? "Custom domain");
  let slug = slugify(asString(obj.slug) || title, "custom");
  if (slug === "generic" || slug === "philosophy") slug = `${slug}-custom`;

  const unitNoun = asString(obj.unit_noun, gen.ontology.unit_noun);
  const groupNoun = asString(obj.group_noun, gen.ontology.group_noun);

  const relationRaw = Array.isArray(obj.relation_types) ? obj.relation_types : [];
  const relationTypes = relationRaw
    .map((r) => {
      if (typeof r === "string") return { name: r.trim() };
      if (r && typeof r === "object") {
        const rec = r as Record<string, unknown>;
        const name = asString(rec.name);
        if (!name) return null;
        const description = asString(rec.description);
        return description ? { name, description } : { name };
      }
      return null;
    })
    .filter((r): r is { name: string; description?: string } => Boolean(r))
    .slice(0, 100);
  const relations = relationTypes.length ? relationTypes : gen.ontology.relation_types;

  const patternsRaw = Array.isArray(obj.relationship_patterns) ? obj.relationship_patterns : [];
  const relationship_patterns = patternsRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const rec = p as Record<string, unknown>;
      const from_unit_type = asString(rec.from_unit_type);
      const relation = asString(rec.relation);
      const to_unit_type = asString(rec.to_unit_type);
      if (!from_unit_type || !relation || !to_unit_type) return null;
      return { from_unit_type, relation, to_unit_type };
    })
    .filter((p): p is { from_unit_type: string; relation: string; to_unit_type: string } => Boolean(p))
    .slice(0, 300);

  const schemaModeRaw = asString(obj.schema_mode, "guided");
  const schema_mode = (["strict", "guided", "open"] as const).includes(schemaModeRaw as never)
    ? (schemaModeRaw as "strict" | "guided" | "open")
    : "guided";

  const relationEdges = relations.map((r) => identifier(r.name, "relates_to"));

  const archetypeRaw = asString(obj.archetype);
  const archetypes = ["argumentative", "factual", "procedural", "product_docs", "generic"] as const;
  const archetype: ConnectPackArchetype = archetypes.includes(archetypeRaw as ConnectPackArchetype)
    ? (archetypeRaw as ConnectPackArchetype)
    : inferArchetypeFromSlug(slug);

  const promptsObj = obj.prompts && typeof obj.prompts === "object" && !Array.isArray(obj.prompts)
    ? (obj.prompts as Record<string, unknown>)
    : {};
  const markerLexicon = asStringArray(obj.marker_lexicon, 200);

  const candidate: ConnectDomainPackUpsert = {
    slug,
    title,
    description: asString(obj.description) || undefined,
    archetype,
    prompt_template_version: 1,
    prompts: {
      ...(asString(promptsObj.extraction) ? { extraction: asString(promptsObj.extraction) } : {}),
      ...(asString(promptsObj.validation) ? { validation: asString(promptsObj.validation) } : {}),
      ...(asString(promptsObj.remediation) ? { remediation: asString(promptsObj.remediation) } : {}),
      ...(asString(promptsObj.grouping) ? { grouping: asString(promptsObj.grouping) } : {}),
      ...(asString(promptsObj.relations) ? { relations: asString(promptsObj.relations) } : {}),
    },
    ontology: {
      unit_noun: unitNoun,
      group_noun: groupNoun,
      domains: asStringArray(obj.domains, 200),
      unit_types: asStringArray(obj.unit_types, 100),
      relation_types: relations,
      group_roles: asStringArray(obj.group_roles, 100),
      relationship_patterns,
      schema_mode,
    },
    graph_schema: {
      source_table: "source",
      passage_table: "passage",
      unit_table: identifier(unitNoun, "unit"),
      group_table: identifier(groupNoun, "group"),
      part_of_edge: "part_of",
      relation_edges: relationEdges,
    },
    passage_profile: {
      marker_lexicon: markerLexicon,
      min_passage_chars: 400,
      max_passage_chars: 6000,
    },
    chunking: { strategy: "structure_aware", min_chars: 400, max_chars: 4000, overlap_chars: 0 },
    parser: { provider: "builtin" },
    embedding: { model: "voyage-3", dimensions: 1024 },
  };

  const draft = ConnectDomainPackUpsertSchema.parse(candidate);
  const rationale = asString(obj.rationale) || undefined;
  return { draft, rationale };
}
