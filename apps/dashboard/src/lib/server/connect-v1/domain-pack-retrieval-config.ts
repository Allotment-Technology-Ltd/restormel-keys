/**
 * Maps a Connect domain pack (the customisable ingest ontology) onto a graphrag-core
 * RetrievalConfig, so the graph orchestrator retrieves against whatever schema/vocabulary
 * the workspace's graph was actually built with — philosophy, legal, biomedical, or custom.
 *
 * Structural fields (taxonomy, relations, argument roles, table names, presentation) come from
 * the pack; tuning (traversal beam, origin balance, verification vocabulary) inherits the
 * philosophy preset's sensible defaults.
 */
import {
  philosophyRetrievalConfig,
  type RetrievalConfig,
  type RelationTraversalEdge,
  type ReasoningClass,
} from "@restormel/graphrag-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";

/** Per-edge priors for well-known relation names; unknown edges default to neutral 1.0. */
const KNOWN_EDGE_PRIORS: Record<string, number> = {
  supports: 1.04,
  contradicts: 1.16,
  depends_on: 0.92,
  responds_to: 1.2,
  defines: 0.9,
  qualifies: 0.88,
  refines: 0.86,
  exemplifies: 0.82,
  relates_to: 1.0,
};

const NEUTRAL_CORPUS_SIGNALS = [
  "overview",
  "survey",
  "summary",
  "big picture",
  "main points",
  "main positions",
  "historical development",
  "in general",
  "across",
];

function reasoningClassFor(name: string): ReasoningClass {
  const n = name.toLowerCase();
  if (/depend|cause|because|entail|presuppos|ground/.test(n)) return "causal";
  if (/respond|repl|rebut|answer|follow|sequence|temporal|after|before/.test(n)) return "temporal";
  if (/defin|qualif|refin|part_of|member|contains|subclass|type_of/.test(n)) return "structural";
  return "semantic";
}

function firstMatch(values: string[], re: RegExp): string | undefined {
  return values.find((v) => re.test(v.toLowerCase()));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function mapDomainPackToRetrievalConfig(pack: ConnectDomainPack): RetrievalConfig {
  const { ontology } = pack;
  const graphSchema = pack.graph_schema;
  const unitTypes = ontology.unit_types ?? [];
  const groupRoles = ontology.group_roles ?? [];
  const patterns = ontology.relationship_patterns ?? [];
  const domains = ontology.domains ?? [];

  // Relation edges: prefer the physical edge tables, else ontology relation type names.
  const relationEdgeNames =
    graphSchema.relation_edges.length > 0
      ? graphSchema.relation_edges
      : ontology.relation_types.map((r) => r.name);

  const traversalEdges: RelationTraversalEdge[] = relationEdgeNames.map((name) => ({
    table: name,
    edgePrior: KNOWN_EDGE_PRIORS[name] ?? 1.0,
    reasoningClass: reasoningClassFor(name),
  }));
  const fetchEdges = relationEdgeNames.map((name) => ({ table: name, relationType: name }));

  // Closure relations — name heuristics, augmented by relationship_patterns.
  const contradictionEdge =
    firstMatch(relationEdgeNames, /contradict|object|refut|overrul|dissent|rebut|conflict/) ??
    patterns.find((p) => /contradict|object|refut|overrul|dissent/.test(p.relation.toLowerCase()))
      ?.relation ??
    relationEdgeNames[0] ??
    "contradicts";
  const replyEdge =
    firstMatch(relationEdgeNames, /respond|repl|rebut|answer|address|concur/) ??
    patterns.find((p) => /respond|repl|rebut|answer/.test(p.relation.toLowerCase()))?.relation ??
    "responds_to";

  // Claim-type taxonomy (thesis / objection / reply) from unit types + patterns.
  const contradictionPatterns = patterns.filter((p) => p.relation === contradictionEdge);
  const replyPatterns = patterns.filter((p) => p.relation === replyEdge);
  const objectionTypes = unique([
    ...unitTypes.filter((t) => /objection|counter|dissent|rebuttal|challenge/.test(t.toLowerCase())),
    ...contradictionPatterns.map((p) => p.from_unit_type),
  ]);
  const replyTypes = unique([
    ...unitTypes.filter((t) => /repl|response|rebuttal|concurrence|answer/.test(t.toLowerCase())),
    ...replyPatterns.map((p) => p.from_unit_type),
  ]);
  const thesisTypes = unique([
    ...unitTypes.filter((t) =>
      /thesis|conclusion|holding|claim|assertion|finding|position|statement/.test(t.toLowerCase()),
    ),
    ...contradictionPatterns.map((p) => p.to_unit_type),
  ]);
  const taken = new Set([...thesisTypes, ...objectionTypes, ...replyTypes]);
  const thesisFallbackTypes = unitTypes.filter((t) => !taken.has(t));

  // Argument roles.
  const conclusionRole = firstMatch(groupRoles, /conclusion|summary|holding|verdict|main/) ?? "conclusion";
  const keyPremiseRole = firstMatch(groupRoles, /key.?premise|key.?point|key|premise/) ?? "key_premise";
  const supportingPremiseRole =
    firstMatch(groupRoles, /support|detail|caveat|evidence/) ?? "supporting_premise";
  const membershipRoleRank: Record<string, number> = {
    [conclusionRole]: 0,
    [keyPremiseRole]: 1,
    [supportingPremiseRole]: 2,
  };

  return {
    ...philosophyRetrievalConfig,
    claimTaxonomy: {
      thesisTypes: thesisTypes.length > 0 ? thesisTypes : unitTypes.slice(0, 1),
      objectionTypes,
      replyTypes,
      thesisFallbackTypes,
    },
    relations: {
      traversalEdges,
      fetchEdges,
      contradictionEdge,
      replyEdge,
      strengthWeights: philosophyRetrievalConfig.relations.strengthWeights,
    },
    arguments: {
      membershipEdge: graphSchema.part_of_edge,
      conclusionRole,
      keyPremiseRole,
      supportingPremiseRole,
      membershipRoleRank,
    },
    closure: {
      enabled: objectionTypes.length > 0 && replyTypes.length > 0,
      maxMajorTheses: philosophyRetrievalConfig.closure.maxMajorTheses,
    },
    domain: {
      enabled: domains.length > 0,
      fallbackDomain: domains[0] ?? "general",
      fallbackClaimType: thesisFallbackTypes[0] ?? unitTypes[0] ?? ontology.unit_noun,
    },
    lexical: {
      corpusLevelSignals: NEUTRAL_CORPUS_SIGNALS,
      knownPhrases: pack.passage_profile.marker_lexicon ?? [],
    },
    schema: {
      unitTable: graphSchema.unit_table,
      passageTable: graphSchema.passage_table,
      sourceTable: graphSchema.source_table,
      groupTable: graphSchema.group_table,
      vectorField: graphSchema.unit_vector_field,
    },
    // Thinker/Wikidata enrichment is philosophy-specific and unused by the orchestrator path.
    entityEnrichment: undefined,
    presentation: {
      header: `=== ${pack.title.toUpperCase()} — KNOWLEDGE GRAPH CONTEXT ===`,
      intro: `The following are structured ${ontology.unit_noun}s from your "${pack.title}" knowledge graph. Use them as grounding, noting their typed relations and source attributions.`,
      footer: "Verify, challenge, or extend these claims with current sources.",
      annotateVerification: true,
    },
  };
}
