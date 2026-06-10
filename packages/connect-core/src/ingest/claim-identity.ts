/**
 * Stage 3.2 — deterministic claim identity + incremental re-ingest planning.
 * (docs/decisions/verified-memory-incremental-ingest.md, signed off 2026-06-10)
 *
 * A CLAIM is a stable identity; a claim VERSION is one (text, evidence span, source
 * version) instantiation of it. Identity is deterministic only — no embeddings, no LLM
 * matcher — so it stays auditable:
 *
 *   claim_key = sha256(source_key + normalized(evidence_quote))
 *
 * using the SAME normalization the Layer-1 binder uses (whitespace/quote/dash/case
 * folding), so two extractions that quote the same supporting text in the same document
 * are the same claim, whatever minor rewording the extractor applied to the claim text.
 * Units the extractor returned no quote for fall back to normalized claim TEXT identity
 * (`text:` prefix, recorded in the key material) — weaker, but deterministic; without a
 * quote there is nothing stabler to hang identity on.
 *
 * The re-ingest planner classifies a changed document's claims into:
 *   - carried  — same claim_key, same normalized text: keep verification state, never
 *                re-judge (the span is re-pinned to the new source hash by the binder);
 *   - changed  — same claim_key, text changed: new version, re-validate this one only;
 *   - added    — no prior claim with this key: new claim, full verification;
 *   - removed  — prior claim_keys that did not reappear: supersede (valid_to +
 *                provenance chain) — reversible, never hard-deleted, never silently kept.
 *
 * Nothing here touches unit-record ids (readiness-runs cohort invariant: Surreal unit-id
 * format must match across services — identity lives ALONGSIDE units, not in their keys).
 */
import { contentHash, normalizeForMatch } from "./evidence-binding.js";

/** Stable identity of a source document across ingest runs (NOT the per-run source row id). */
export function deriveClaimSourceKey(args: {
  canonicalUrl?: string | null;
  url?: string | null;
  title?: string | null;
}): string {
  const canonical = args.canonicalUrl?.trim();
  if (canonical) return `url:${canonical}`;
  const url = args.url?.trim();
  if (url) return `url:${url}`;
  const title = args.title?.trim();
  if (title) return `title:${normalizeForMatch(title)}`;
  return "untitled";
}

/**
 * Deterministic claim identity (ADR §1). Same key ⇒ same claim. Quote-anchored when the
 * extractor supplied evidence; normalized-text fallback (recorded in the key material as
 * `text:`) when it did not.
 */
export async function computeClaimKey(args: {
  sourceKey: string;
  /** The evidence quote as extracted (bound or not) — identity does not require binding. */
  evidenceQuote?: string | null;
  /** Claim text — fallback identity for quote-less units. */
  text: string;
}): Promise<string> {
  const quote = args.evidenceQuote?.trim();
  const material = quote
    ? `${args.sourceKey}\nquote:${normalizeForMatch(quote)}`
    : `${args.sourceKey}\ntext:${normalizeForMatch(args.text)}`;
  return contentHash(material);
}

/** A current (valid_to IS NULL) claim version loaded from the store before re-ingest. */
export type PriorClaimVersion = {
  /** Store row id of the version record (stringified; chained via superseded_by). */
  versionId: string;
  claimKey: string | null;
  versionNo: number;
  /** The unit record this version annotates (per-run id; cohort invariant untouched). */
  unitId: string;
  text: string;
  verificationState: string | null;
  judgedBy: string | null;
  judgedAt: string | null;
  validationStatus: string | null;
  validationNote: string | null;
};

/** A freshly extracted unit with its computed identity. */
export type NextClaim = {
  unitId: string;
  text: string;
  claimKey: string;
};

export type ReingestPlan = {
  /** Same claim, same text: carry verification state forward — zero judge calls. */
  carried: { next: NextClaim; prior: PriorClaimVersion }[];
  /** Same claim, text changed: new version — re-validate only this one. */
  changed: { next: NextClaim; prior: PriorClaimVersion }[];
  /** New claim (no prior key match): full verification. */
  added: NextClaim[];
  /** Prior claims whose key did not reappear: supersede, reversible — never orphaned. */
  removed: PriorClaimVersion[];
};

/**
 * Deterministic re-ingest diff for ONE source document (ADR §3 step 2).
 * Matching is by claim_key only; prior versions without a key (legacy rows) can never
 * match and are superseded — visible and reversible, never silently kept.
 * Duplicate keys are handled deterministically: the highest-version prior is the match
 * candidate; extra next-claims with an already-matched key become `added`.
 */
export function planIncrementalReingest(args: {
  prior: PriorClaimVersion[];
  next: NextClaim[];
}): ReingestPlan {
  const priorByKey = new Map<string, PriorClaimVersion>();
  for (const p of args.prior) {
    if (!p.claimKey) continue;
    const existing = priorByKey.get(p.claimKey);
    if (!existing || p.versionNo > existing.versionNo) priorByKey.set(p.claimKey, p);
  }

  const plan: ReingestPlan = { carried: [], changed: [], added: [], removed: [] };
  const matchedKeys = new Set<string>();
  const matchedVersionIds = new Set<string>();
  for (const next of args.next) {
    const prior = priorByKey.get(next.claimKey);
    if (!prior || matchedKeys.has(next.claimKey)) {
      plan.added.push(next);
      continue;
    }
    matchedKeys.add(next.claimKey);
    matchedVersionIds.add(prior.versionId);
    if (normalizeForMatch(next.text) === normalizeForMatch(prior.text)) {
      plan.carried.push({ next, prior });
    } else {
      plan.changed.push({ next, prior });
    }
  }
  // Everything not matched 1:1 is superseded — including stray duplicate-key rows, so
  // re-ingest always leaves exactly one current version per surviving claim.
  for (const p of args.prior) {
    if (!matchedVersionIds.has(p.versionId)) plan.removed.push(p);
  }
  return plan;
}

/** One link of a claim's provenance chain, as stored on the version rows. */
export type ClaimVersionChainRow = {
  versionId: string;
  versionNo: number;
  unitId: string;
  text: string;
  verificationState: string | null;
  sourceHash: string | null;
  validFrom: string | null;
  validTo: string | null;
  supersededBy: string | null;
};

export type ClaimSupersessionTrace = {
  /** Versions ordered oldest → newest by following superseded_by links. */
  chain: ClaimVersionChainRow[];
  /** The current version (valid_to NULL), when one exists. */
  current: ClaimVersionChainRow | null;
  /** True when every closed version's superseded_by resolves to a row in the chain. */
  intact: boolean;
};

/**
 * Provenance trace of one claim's supersession chain: order versions oldest → newest
 * and verify every closed version links forward to a row that exists. Removed claims
 * end with a closed version whose superseded_by is null (no successor) — superseded,
 * not orphaned.
 */
export function buildSupersessionTrace(rows: ClaimVersionChainRow[]): ClaimSupersessionTrace {
  const chain = [...rows].sort(
    (a, b) => a.versionNo - b.versionNo || a.versionId.localeCompare(b.versionId),
  );
  const ids = new Set(chain.map((r) => r.versionId));
  const current = chain.filter((r) => r.validTo == null).at(-1) ?? null;
  const intact = chain.every((r) => {
    if (r.validTo == null) return r.supersededBy == null;
    return r.supersededBy == null || ids.has(r.supersededBy);
  });
  return { chain, current, intact };
}
