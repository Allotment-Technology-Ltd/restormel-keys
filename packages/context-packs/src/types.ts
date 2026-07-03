/**
 * Claim fields read by context pack selection and rendering.
 */
export interface ContextPackClaim {
  id: string;
  text: string;
  claim_type: string;
  source_title: string;
  /** Optional numeric confidence used in per-pass scoring (defaults to 0). */
  confidence?: number;
}

/**
 * Relation fields read by context packs (index-local graph).
 */
export interface ContextPackRelation {
  from_index: number;
  to_index: number;
  relation_type: string;
}

/**
 * Argument fields read by context packs.
 * `key_premises` and `conclusion_text` are optional; when present they contribute to argument ranking
 * (same heuristic as SOPHIA `RetrievedArgument` scoring).
 */
export interface ContextPackArgument {
  name: string;
  /** Display tradition / school; may be null when unknown. */
  tradition: string | null;
  summary: string;
  /** Optional premises list; each entry adds weight when ranking arguments for a pass. */
  key_premises?: string[];
  /** Optional conclusion line; adds weight when ranking arguments for a pass. */
  conclusion_text?: string;
}

/**
 * Optional correlation for `@restormel/state` timelines and `@restormel/observability` runs.
 * Ignored when rendering pack text; safe to attach for operator debugging.
 */
export interface ContextPackRestormelCorrelation {
  run_id?: string;
  retrieval_version?: string;
  state_sequence?: number;
  materialized_memory_event_ids?: string[];
}

/**
 * Minimal retrieval payload for pass-specific context packs (analysis / critique / synthesis).
 * No DB driver, trace, or lineage fields — hosts map full retrieval DTOs onto this shape.
 */
export interface ContextPackRetrievalInput {
  claims: ContextPackClaim[];
  relations: ContextPackRelation[];
  arguments: ContextPackArgument[];
  seed_claim_ids: string[];
  /** Optional; carried through for cross-linking memory + traces; not read by pack builders. */
  restormel_correlation?: ContextPackRestormelCorrelation;
}

export type ContextPackPass = "analysis" | "critique" | "synthesis";

export type ContextPackRole = "support" | "objection" | "reply" | "definition_distinction";

/**
 * Diagnostics for one rendered context pack block (token budget, composition, graph signals).
 */
export interface ContextPackStats {
  /** Configured approximate token budget for this pass (from depth mode). */
  token_budget: number;
  /** Estimated tokens for the final `block` text (`ceil(character_length / 4)`). */
  estimated_tokens: number;
  /** True when claims were dropped in the truncation loop to fit the budget. */
  truncated: boolean;
  /** Number of claims included after selection and any truncation. */
  claim_count: number;
  /** Number of relations included (both endpoints in the kept claim set). */
  relation_count: number;
  /** Number of structured arguments included in the block. */
  argument_count: number;
  /** Counts of claims by derived role for the kept claim set. */
  role_counts: Record<ContextPackRole, number>;
  /**
   * Distinct reply↔objection `responds_to` edges among kept relations (reply chain signal).
   */
  reply_chain_count: number;
  /**
   * Contradiction pairs among kept relations that are not “resolved” by a matching reply chain
   * on the same undirected pair (tension signal).
   */
  unresolved_tension_count: number;
}

export interface ContextPack {
  pass: ContextPackPass;
  /** Rendered text block for the LLM pass. */
  block: string;
  stats: ContextPackStats;
}

export interface PassSpecificContextPacks {
  analysis: ContextPack;
  critique: ContextPack;
  synthesis: ContextPack;
}
