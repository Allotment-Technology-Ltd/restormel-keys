/**
 * Domain-agnostic graph extraction (DI). The host injects a `generate` function
 * (LLM call); this module composes the pack-driven prompt, parses the result,
 * and analyzes quality (orphans, type/pattern violations). Reused by the dry-run
 * preview and full execution so previews reflect real runs.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from "./extraction-prompt.js";
import type { ConnectQualityPreset } from "./quality-preset.js";
import type { GraphIngestContext } from "./prompt-compose.js";

export interface ExtractedUnit {
  id: string;
  text: string;
  type?: string;
  domain?: string;
  /** Verbatim supporting quote from the passage (EBV Layer 1 binds + verifies it). */
  evidence?: string;
}

export interface ExtractedRelation {
  from: string;
  relation: string;
  to: string;
}

export interface ExtractionWarning {
  code:
    | "no_units"
    | "no_relations"
    | "orphan_units"
    | "unknown_unit_type"
    | "unknown_relation_type"
    | "pattern_violation"
    | "dangling_relation";
  severity: "info" | "warning";
  message: string;
  count?: number;
}

export interface ExtractionResult {
  units: ExtractedUnit[];
  relations: ExtractedRelation[];
  warnings: ExtractionWarning[];
}

/** Injected LLM call: returns the model's raw text (expected to be JSON). */
export type ExtractionGenerate = (input: { system: string; user: string }) => Promise<string>;

function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseExtractionResponse(raw: string): { units: ExtractedUnit[]; relations: ExtractedRelation[] } {
  const obj = parseJsonLoose(raw) as Record<string, unknown> | null;
  const unitsRaw = Array.isArray(obj?.units) ? (obj!.units as unknown[]) : [];
  const relationsRaw = Array.isArray(obj?.relations) ? (obj!.relations as unknown[]) : [];

  const units: ExtractedUnit[] = [];
  for (const u of unitsRaw) {
    if (!u || typeof u !== "object") continue;
    const rec = u as Record<string, unknown>;
    const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : `u${units.length + 1}`;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!text) continue;
    units.push({
      id,
      text,
      ...(typeof rec.type === "string" && rec.type.trim() ? { type: rec.type.trim() } : {}),
      ...(typeof rec.domain === "string" && rec.domain.trim() ? { domain: rec.domain.trim() } : {}),
      ...(typeof rec.evidence === "string" && rec.evidence.trim() ? { evidence: rec.evidence.trim() } : {}),
    });
  }

  const relations: ExtractedRelation[] = [];
  for (const r of relationsRaw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const from = typeof rec.from === "string" ? rec.from.trim() : "";
    const relation = typeof rec.relation === "string" ? rec.relation.trim() : "";
    const to = typeof rec.to === "string" ? rec.to.trim() : "";
    if (from && relation && to) relations.push({ from, relation, to });
  }

  return { units, relations };
}

/** Compute quality warnings against the pack's ontology. */
export function analyzeExtraction(
  units: ExtractedUnit[],
  relations: ExtractedRelation[],
  pack: ConnectDomainPack,
): ExtractionWarning[] {
  const warnings: ExtractionWarning[] = [];
  const o = pack.ontology;

  if (units.length === 0) {
    warnings.push({ code: "no_units", severity: "warning", message: "No units were extracted from the sample." });
    return warnings;
  }

  const unitById = new Map(units.map((u) => [u.id, u]));

  // Orphans: units that participate in no relationship.
  const connected = new Set<string>();
  for (const r of relations) {
    if (unitById.has(r.from)) connected.add(r.from);
    if (unitById.has(r.to)) connected.add(r.to);
  }
  const orphanCount = units.filter((u) => !connected.has(u.id)).length;
  if (relations.length === 0) {
    warnings.push({
      code: "no_relations",
      severity: "warning",
      message: "No relationships were extracted — the graph would be disconnected units (the philosophy lesson).",
    });
  } else if (orphanCount > 0) {
    warnings.push({
      code: "orphan_units",
      severity: "warning",
      message: `${orphanCount} unit(s) have no relationships — possible isolated chunks.`,
      count: orphanCount,
    });
  }

  // Dangling relations: reference a missing unit id.
  const dangling = relations.filter((r) => !unitById.has(r.from) || !unitById.has(r.to)).length;
  if (dangling > 0) {
    warnings.push({
      code: "dangling_relation",
      severity: "warning",
      message: `${dangling} relationship(s) reference a unit that was not extracted.`,
      count: dangling,
    });
  }

  if (o.schema_mode !== "open") {
    if (o.unit_types.length) {
      const allowed = new Set(o.unit_types);
      const bad = units.filter((u) => u.type && !allowed.has(u.type)).length;
      if (bad > 0) {
        warnings.push({
          code: "unknown_unit_type",
          severity: o.schema_mode === "strict" ? "warning" : "info",
          message: `${bad} unit(s) use a type not in the ontology.`,
          count: bad,
        });
      }
    }
    if (o.relation_types.length) {
      const allowed = new Set(o.relation_types.map((r) => r.name));
      const bad = relations.filter((r) => !allowed.has(r.relation)).length;
      if (bad > 0) {
        warnings.push({
          code: "unknown_relation_type",
          severity: o.schema_mode === "strict" ? "warning" : "info",
          message: `${bad} relationship(s) use a relation type not in the ontology.`,
          count: bad,
        });
      }
    }
    if (o.schema_mode === "strict" && o.relationship_patterns.length) {
      const patternKey = new Set(
        o.relationship_patterns.map((p) => `${p.from_unit_type}|${p.relation}|${p.to_unit_type}`),
      );
      const bad = relations.filter((r) => {
        const f = unitById.get(r.from);
        const t = unitById.get(r.to);
        if (!f?.type || !t?.type) return false;
        return !patternKey.has(`${f.type}|${r.relation}|${t.type}`);
      }).length;
      if (bad > 0) {
        warnings.push({
          code: "pattern_violation",
          severity: "warning",
          message: `${bad} relationship(s) do not match an allowed pattern (strict mode).`,
          count: bad,
        });
      }
    }
  }

  return warnings;
}

/** Run extraction over a piece of text using the pack-driven, enforced prompt. */
export async function extractGraph(args: {
  text: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
  graphContext?: GraphIngestContext;
}): Promise<ExtractionResult> {
  const system = buildExtractionSystemPrompt(args.pack, {
    qualityPreset: args.qualityPreset,
    graphContext: args.graphContext,
  });
  const user = buildExtractionUserPrompt(args.text);
  const raw = await args.generate({ system, user });
  const { units, relations } = parseExtractionResponse(raw);
  const warnings = analyzeExtraction(units, relations, args.pack);
  return { units, relations, warnings };
}
