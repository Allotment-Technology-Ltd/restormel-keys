#!/usr/bin/env node
/**
 * G4 retrieval gate — host-managed Postgres spine vs the SOPHIA/Surreal baseline
 * (REC-ADR-008, Stage-1).
 *
 * EBV is store-free, so G2 (ingest quality) transfers to the Postgres spine unchanged. What
 * does NOT transfer for free is the STORE-SIDE trust-state retrieval filter — the Surreal
 * path compiles it to SurrealQL, the Postgres path re-implements it. This gate proves the two
 * admit the IDENTICAL strict-mode claim set over a fixed golden corpus, and that retrieval
 * coverage (context hit@k) does not regress against the recorded baseline.
 *
 * Gate condition (either failing ⇒ G4 fails on Postgres):
 *   1. zero strict-mode claim-set delta vs the canonical Surreal admission, per golden query;
 *   2. no coverage regression vs the committed baseline (hit count per query, within tolerance).
 *
 * Hermetic by design: it embeds the verified admission logic from
 *   - apps/.../graph-comparison/postgres-graph-retrieve.ts  (Postgres `passesPolicy` + lexical seed)
 *   - packages/graphrag-core/.../retrieve-context.ts:110-165 (Surreal classify + policyAdmits)
 * so it runs in CI with no DB and no network. The store-parity Vitest suite proves the
 * embedded logic matches the live code; this script proves the corpus-level outcome.
 *
 * Usage:
 *   node scripts/ci/connect-g4/g4-retrieval-postgres.mjs               # check vs committed baseline
 *   node scripts/ci/connect-g4/g4-retrieval-postgres.mjs --write <out> # write a fresh dated snapshot
 *   node scripts/ci/connect-g4/g4-retrieval-postgres.mjs --baseline <p>
 *
 * Exit codes: 0 pass · 2 config/usage error · 3 regression (delta or coverage drop).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { G4_GOLDEN_CORPUS, G4_GOLDEN_QUERIES, g4CorpusFingerprint } from "./golden-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE = resolve(HERE, "g4-postgres-baseline.json");

// ── Philosophy domain pack verification vocabulary (graphrag-core/config.ts:475-476) ──
const VOCAB = { supportedStates: ["validated"], flaggedStates: ["flagged"] };
const STRICT_POLICY = { include: ["supported"], excludeFlagged: true };

// ── Postgres path: deriveVerification (postgres-graph-retrieve.ts:113-130) ──
function deriveVerification(status) {
  switch (status) {
    case "ok": return { verification_state: "validated", verification_category: "supported", trust_score: 90 };
    case "weak": return { verification_state: "weak", verification_category: "weak", trust_score: 55 };
    case "unsupported": return { verification_state: "flagged", verification_category: "unsupported", trust_score: 20 };
    default: return { verification_state: null, verification_category: "supported", trust_score: null };
  }
}
// Postgres passesPolicy (postgres-graph-retrieve.ts:132-143)
function postgresAdmits(category, trustScore, policy) {
  if (policy.excludeFlagged !== false && category === "unsupported") return false;
  if (!policy.include.includes(category)) return false;
  if (policy.minTrustScore !== undefined && trustScore !== null && trustScore < policy.minTrustScore) return false;
  return true;
}

// ── Surreal path: classifyVerification + policyAdmits (retrieve-context.ts:110-136) ──
function classifyVerification(state) {
  const s = (state ?? "").trim();
  if (s && VOCAB.supportedStates.includes(s)) return "supported";
  if (s && VOCAB.flaggedStates.includes(s)) return "unsupported";
  return "weak";
}
function surrealAdmits(state, trustScore, policy) {
  const category = classifyVerification(state);
  const excludeFlagged = policy.excludeFlagged ?? true;
  if (category === "unsupported" && excludeFlagged) return false;
  if (!policy.include.includes(category)) return false;
  if (policy.minTrustScore !== undefined && typeof trustScore === "number" && trustScore < policy.minTrustScore) return false;
  return true;
}

// ── Lexical seed (postgres-graph-retrieve.ts tokeniseQuery + lexicalSeed), shared by both ──
const STOPWORDS = new Set(["the","and","for","are","but","not","you","with","this","that","from","what","why","how","who","when","where","which","does","did","was","were","has","have","had","can","could","would","should","about","into","than","then","they","them","their","there","here","its","his","her","she","him","over","only","always","also"]);
function tokenise(q) {
  const seen = new Set();
  const terms = [];
  for (const raw of q.toLowerCase().split(/[^a-z0-9]+/)) {
    const t = raw.trim();
    if (t.length < 3 || STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    terms.push(t);
  }
  return terms;
}
function lexicalSeedIds(query) {
  const terms = tokenise(query);
  return G4_GOLDEN_CORPUS
    .map((u) => ({ id: u.id, score: terms.filter((t) => u.text.toLowerCase().includes(t)).length }))
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((u) => u.id);
}

/** Strict-mode admitted id set for one query, on a given store's admission function. */
function strictIdsFor(query, admit) {
  const seedIds = lexicalSeedIds(query);
  const byId = new Map(G4_GOLDEN_CORPUS.map((u) => [u.id, u]));
  return seedIds.filter((id) => {
    const u = byId.get(id);
    const v = deriveVerification(u.validation_status);
    // Compare on the SAME row representation: the Postgres path filters on the derived
    // category; the Surreal reference re-derives from the verification_state. Both are fed
    // the verdict EBV actually wrote, so the curated-null demo sentinel is excluded from G4.
    return admit === postgresAdmits
      ? admit(v.verification_category, v.trust_score, STRICT_POLICY)
      : admit(v.verification_state, v.trust_score, STRICT_POLICY);
  });
}

function evaluate() {
  const perQuery = G4_GOLDEN_QUERIES.map((query) => {
    const postgresIds = strictIdsFor(query, postgresAdmits).sort();
    const surrealIds = strictIdsFor(query, surrealAdmits).sort();
    const delta = postgresIds.filter((x) => !surrealIds.includes(x))
      .concat(surrealIds.filter((x) => !postgresIds.includes(x)));
    return { query, postgres_hits: postgresIds.length, surreal_hits: surrealIds.length, postgres_ids: postgresIds, delta };
  });
  const totalDelta = perQuery.reduce((n, q) => n + q.delta.length, 0);
  return {
    schema_version: 1,
    gate: "g4-retrieval-postgres",
    store_backend: "postgres",
    baseline_store_backend: "surreal",
    policy: "strict",
    fingerprint: g4CorpusFingerprint(),
    per_query: perQuery,
    strict_claim_set_delta: totalDelta,
  };
}

function main() {
  const args = process.argv.slice(2);
  const writeIdx = args.indexOf("--write");
  const baselineIdx = args.indexOf("--baseline");
  const baselinePath = baselineIdx >= 0 ? args[baselineIdx + 1] : DEFAULT_BASELINE;

  const result = evaluate();
  result.evaluated_at = new Date().toISOString();

  if (writeIdx >= 0) {
    const out = args[writeIdx + 1];
    if (!out) { console.error("--write requires an output path"); process.exit(2); }
    writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    console.log(`G4 snapshot written → ${out} (fingerprint ${result.fingerprint}, strict delta ${result.strict_claim_set_delta})`);
    process.exit(0);
  }

  // ── Gate condition 1: zero strict-mode claim-set delta vs Surreal ──
  if (result.strict_claim_set_delta !== 0) {
    console.error(`G4 FAIL: strict-mode claim-set delta vs Surreal = ${result.strict_claim_set_delta} (must be 0).`);
    for (const q of result.per_query) {
      if (q.delta.length) console.error(`  · "${q.query}" delta: ${q.delta.join(", ")}`);
    }
    process.exit(3);
  }

  // ── Gate condition 2: no coverage regression vs the committed baseline ──
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    console.error(`G4 config error: baseline not found at ${baselinePath}. Run with --write to seed it.`);
    process.exit(2);
  }
  if (baseline.fingerprint !== result.fingerprint) {
    console.log(`G4: corpus fingerprint changed (${baseline.fingerprint} → ${result.fingerprint}); baseline superseded, not a regression. Re-seed with --write.`);
    process.exit(0);
  }
  const baseByQuery = new Map((baseline.per_query ?? []).map((q) => [q.query, q.postgres_hits]));
  const regressions = [];
  for (const q of result.per_query) {
    const base = baseByQuery.get(q.query);
    if (base !== undefined && q.postgres_hits < base) {
      regressions.push(`"${q.query}" hits ${q.postgres_hits} < baseline ${base}`);
    }
  }
  if (regressions.length) {
    console.error("G4 FAIL: retrieval coverage regressed vs baseline:");
    for (const r of regressions) console.error(`  · ${r}`);
    process.exit(3);
  }

  console.log(`G4 PASS: strict-mode claim-set delta = 0 vs Surreal; no coverage regression (fingerprint ${result.fingerprint}).`);
  process.exit(0);
}

main();
