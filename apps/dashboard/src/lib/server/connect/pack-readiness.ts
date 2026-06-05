/**
 * Pack readiness score warnings before ingest (Phase 0e).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { resolvePackArchetype } from "@restormel/connect-core";

export function assessPackReadiness(pack: ConnectDomainPack): string[] {
  const warnings: string[] = [];
  const o = pack.ontology;
  if (!pack.archetype && !pack.prompts?.extraction?.trim()) {
    warnings.push(`Archetype not set — using inferred "${resolvePackArchetype(pack)}" defaults.`);
  }
  if (o.unit_types.length < 2) {
    warnings.push("Ontology has fewer than 2 unit types — extraction may be underspecified.");
  }
  if (o.schema_mode === "strict" && o.relationship_patterns.length === 0) {
    warnings.push("Strict schema mode without relationship patterns — expect high quarantine volume.");
  }
  if (!pack.passage_profile?.marker_lexicon?.length && resolvePackArchetype(pack) === "argumentative") {
    warnings.push("Argumentative archetype without passage marker lexicon — consider adding discourse markers.");
  }
  return warnings;
}
