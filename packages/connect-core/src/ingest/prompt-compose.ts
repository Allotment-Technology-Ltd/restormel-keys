/**
 * Central pack- and graph-weighted prompt composer for all ingest stages.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ConnectQualityPreset } from "./quality-preset.js";
import {
  getArchetypeStageIntro,
  inferArchetypeFromSlug,
  PROMPT_TEMPLATE_VERSION,
  type IngestPromptStage,
  type PackArchetype,
} from "./prompt-templates/index.js";

export type { PackArchetype, IngestPromptStage };

/** Lightweight graph snapshot injected into extraction + validation prompts. */
export type GraphIngestContext = {
  unitCount: number;
  topUnitTypes: { type: string; count: number }[];
  relationCount: number;
  isGreenfield: boolean;
};

export type IngestPromptContext = {
  pack: ConnectDomainPack;
  stage: IngestPromptStage;
  qualityPreset?: ConnectQualityPreset;
  graphContext?: GraphIngestContext;
};

export function resolvePackArchetype(pack: ConnectDomainPack): PackArchetype {
  if (pack.archetype) return pack.archetype;
  return inferArchetypeFromSlug(pack.slug);
}

/** Builtin pack DB version overrides shipped template default after admin calibration. */
export function resolvePromptTemplateVersion(pack: ConnectDomainPack): number {
  const packVersion = pack.prompt_template_version;
  if (typeof packVersion === "number" && packVersion > 0) {
    return Math.max(packVersion, PROMPT_TEMPLATE_VERSION);
  }
  return PROMPT_TEMPLATE_VERSION;
}

export function substitutePromptPlaceholders(template: string, pack: ConnectDomainPack): string {
  const o = pack.ontology;
  const domains = o.domains.length ? o.domains.join(", ") : "(none declared)";
  const unitTypes = o.unit_types.length ? o.unit_types.join(", ") : "(discover from corpus)";
  const relationTypes = o.relation_types.length
    ? o.relation_types.map((r) => (r.description ? `${r.name} (${r.description})` : r.name)).join("; ")
    : "(discover from corpus)";
  const groupRoles = o.group_roles.length ? o.group_roles.join(", ") : "(optional)";
  return template
    .replaceAll("{unit_noun}", o.unit_noun)
    .replaceAll("{group_noun}", o.group_noun)
    .replaceAll("{domains}", domains)
    .replaceAll("{unit_types}", unitTypes)
    .replaceAll("{relation_types}", relationTypes)
    .replaceAll("{group_roles}", groupRoles)
    .replaceAll("{pack_title}", pack.title)
    .replaceAll("{schema_mode}", o.schema_mode);
}

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

function ontologyBlock(pack: ConnectDomainPack, stage: IngestPromptStage): string[] {
  const o = pack.ontology;
  const parts: string[] = [];
  if (stage === "extraction" || stage === "relations") {
    if (o.unit_types.length) parts.push(`Unit types (${o.unit_noun}): ${o.unit_types.join(", ")}.`);
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
  }
  if (stage === "grouping" && o.group_roles.length) {
    parts.push(
      `Assign each member a role from: ${o.group_roles.join(", ")}.` +
        (o.schema_mode === "strict" ? " Use only these roles." : ""),
    );
  }
  return parts;
}

function passageProfileBlock(pack: ConnectDomainPack): string | null {
  const lex = pack.passage_profile?.marker_lexicon ?? [];
  if (!lex.length) return null;
  return (
    `Passage markers (salient discourse cues in this domain): ${lex.slice(0, 20).join(", ")}. ` +
    "Prefer extracting units anchored to these rhetorical moves when present."
  );
}

function graphContextBlock(pack: ConnectDomainPack, ctx: GraphIngestContext | undefined): string | null {
  if (!ctx) return null;
  const unitTable = pack.graph_schema.unit_table;
  if (ctx.isGreenfield) {
    return `Greenfield graph — you are establishing the first ${pack.ontology.unit_noun}s in table "${unitTable}". Use consistent types from this source.`;
  }
  const types =
    ctx.topUnitTypes.length > 0
      ? ctx.topUnitTypes.map((t) => `${t.type} (${t.count})`).join(", ")
      : "mixed";
  return (
    `You are extending an existing graph (${ctx.unitCount} ${pack.ontology.unit_noun}s, ${ctx.relationCount} relations). ` +
    `Top unit types: ${types}. Stored as "${unitTable}" — prefer existing relation vocabulary and types where they fit.`
  );
}

function qualityGuardrails(preset: ConnectQualityPreset, stage: IngestPromptStage): string[] {
  if (preset === "starter") {
    if (stage === "extraction") {
      return ["Prefer quality over quantity. Typical passages yield roughly 5–20 units unless exceptionally dense."];
    }
    return [];
  }
  const production: string[] = [];
  if (stage === "extraction") {
    production.push(
      "PRODUCTION CALIBRATION: prefer quality over quantity. Extract distinct, high-signal ideas only. " +
        "Omit a unit when evidence in the passage is weak — do not invent supporting detail. " +
        "Avoid near-duplicates and trivial restatements. Typical passages yield roughly 5–15 units unless exceptionally dense.",
    );
  }
  if (stage === "validation") {
    production.push(
      "PRODUCTION CALIBRATION: calibrate toward \"ok\" for faithful paraphrase. Reserve \"weak\" and \"unsupported\" for misleading claims.",
    );
  }
  if (stage === "remediation") {
    production.push(
      'PRODUCTION CALIBRATION: prefer "drop" over speculative "repair" when the source does not support the unit.',
    );
  }
  return production;
}

function validationStatusBlock(pack: ConnectDomainPack): string {
  const o = pack.ontology;
  const strict = o.schema_mode === "strict";
  return (
    `For each ${o.unit_noun}, return a status:\n` +
    `- "ok": supported by the source, including fair paraphrase or grounded inference\n` +
    `- "weak": materially overstated, missing qualification, or loosely related\n` +
    `- "unsupported": contradicts the source or adds claims with no basis\n` +
    (strict
      ? "In strict schema mode, also flag units whose types or relations violate the ontology as \"weak\"."
      : `Calibrate toward "ok" when the idea is reasonably faithful.`)
  );
}

function remediationActionBlock(pack: ConnectDomainPack): string {
  const o = pack.ontology;
  return (
    `For each ${o.unit_noun}, choose an action:\n` +
    `- "repair": rewrite so it is precise and faithful; provide corrected "text"\n` +
    `- "drop": cannot be supported and should be removed\n` +
    `- "keep": actually fine as-is`
  );
}

export const EXTRACTION_OUTPUT_CONTRACT = `Return STRICT JSON only (no prose):
{
  "units": [{ "id": "u1", "text": "<one complete unit>", "type": "<unit type or omit>", "domain": "<domain or omit>", "evidence": "<the supporting sentence(s), copied VERBATIM from the passage>" }],
  "relations": [{ "from": "u1", "relation": "<relation type>", "to": "u2" }]
}
Each unit id must be unique and referenced by relations. Keep each unit a complete idea, never a fragment.
"evidence" is REQUIRED for every unit: copy the exact supporting text character-for-character from the passage — do not paraphrase, do not abbreviate, do not merge distant sentences. A unit whose evidence cannot be located verbatim in the passage cannot be marked supported. Omit units you cannot quote support for.`;

export const RELATIONS_OUTPUT_CONTRACT = `Return STRICT JSON only:
{ "relations": [{ "from": "<unit id>", "relation": "<relation type>", "to": "<unit id>" }] }
Reference only the provided unit ids.`;

export function composeStageSystemPrompt(ctx: IngestPromptContext): string {
  const { pack, stage, qualityPreset = "production", graphContext } = ctx;
  const archetype = resolvePackArchetype(pack);
  const templateVersion = resolvePromptTemplateVersion(pack);
  const parts: string[] = [];

  if (templateVersion > PROMPT_TEMPLATE_VERSION) {
    parts.push(
      `Prompt calibration v${templateVersion} for archetype "${archetype}" (admin-tuned builtin defaults).`,
    );
  }

  const override = pack.prompts?.[stage]?.trim();
  if (override) {
    parts.push(substitutePromptPlaceholders(override, pack));
  } else {
    const intro = getArchetypeStageIntro(archetype, stage);
    parts.push(substitutePromptPlaceholders(intro, pack));
  }

  parts.push(...ontologyBlock(pack, stage));

  const passage = passageProfileBlock(pack);
  if (passage) parts.push(passage);

  const graph = graphContextBlock(pack, graphContext);
  if (graph && (stage === "extraction" || stage === "validation")) parts.push(graph);

  parts.push(...qualityGuardrails(qualityPreset, stage));

  if (stage === "validation") parts.push(validationStatusBlock(pack));
  if (stage === "remediation") parts.push(remediationActionBlock(pack));

  if (stage === "extraction") parts.push(EXTRACTION_OUTPUT_CONTRACT);
  if (stage === "relations") parts.push(RELATIONS_OUTPUT_CONTRACT);
  if (stage === "grouping") {
    const o = pack.ontology;
    parts.push(
      `Return STRICT JSON only:\n{ "groups": [{ "name": "<short name>", "summary": "<one sentence>", "members": [{ "ref": "<unit ref>", "role": "<role or omit>" }] }] }\n` +
        `Reference units only by the provided refs. Omit a ${o.unit_noun} that does not belong to any ${o.group_noun}.`,
    );
  }
  if (stage === "validation" || stage === "remediation") {
    const shape =
      stage === "validation"
        ? '{ "results": [{ "ref": "<unit ref>", "status": "ok|weak|unsupported", "note": "<short reason or omit>" }] }'
        : '{ "results": [{ "ref": "<unit ref>", "action": "repair|drop|keep", "text": "<corrected text when repairing>" }] }';
    parts.push(`Return STRICT JSON only:\n${shape}\nInclude one result for every listed ref — do not omit units.`);
  }

  return parts.join("\n\n");
}

export function buildRelationsSystemPrompt(
  pack: ConnectDomainPack,
  opts?: { qualityPreset?: ConnectQualityPreset; graphContext?: GraphIngestContext },
): string {
  return composeStageSystemPrompt({
    pack,
    stage: "relations",
    qualityPreset: opts?.qualityPreset,
    graphContext: opts?.graphContext,
  });
}
