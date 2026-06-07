/**
 * Generate up to 5 suggested questions where the knowledge graph should make a *visible*
 * difference versus the raw model — while staying a FAIR comparison.
 *
 * Fairness rule: every question is a genuine subject-matter question the raw model can
 * attempt from training data. We never name source documents and never ask "what is in my
 * documents / sources / knowledge base" — those are unanswerable without the corpus, so the
 * graph would win by default and prove nothing about answer quality. Instead we turn the
 * graph's claims and relations into real questions about the *ideas*, where the graph
 * response adds specific, verified, cited evidence on top of the model's generic answer.
 *
 * Types: A relationship-between-ideas · B contradiction · C evidence · D weak/contested ·
 * E central concept. Remaining slots are filled with claim-derived "is it true that…?"
 * questions. When the graph yields no claims we return [] (the panel then invites a typed
 * question) rather than faking suggestions.
 *
 * Cached per `cacheKey` (caller passes `${workspaceId}:${latestRunId}`) so suggestions only
 * regenerate when a new run completes.
 */
import type { RetrievalResult } from "@restormel/graphrag-core";
import type { SuggestedQuestion } from "$lib/connect/graph-comparison-types";
import { retrieveStructured } from "./retrieve-structured";

const cache = new Map<string, SuggestedQuestion[]>();

export type SuggestQuestionsArgs = {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
  /** `${workspaceId}:${latestRunId}` — regenerates suggestions when it changes. */
  cacheKey: string;
};

export async function suggestQuestions(args: SuggestQuestionsArgs): Promise<SuggestedQuestion[]> {
  const cached = cache.get(args.cacheKey);
  if (cached) return cached;

  const { result } = await retrieveStructured({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: args.projectId,
    query: "overview of the main claims, evidence, and disagreements across these documents",
    maxClaims: 60,
    verificationPolicy: { include: ["supported", "weak", "unsupported"], excludeFlagged: false },
  });

  const questions = buildSuggestions(result);
  // Only cache real (non-empty) results so a transient empty retrieval can recover next load.
  if (questions.length > 0) cache.set(args.cacheKey, questions);
  return questions;
}

/** Pure question synthesis from a retrieval result — exported for tests. */
export function buildSuggestions(result: RetrievalResult): SuggestedQuestion[] {
  const claims = result.claims;
  if (claims.length === 0) return []; // No corpus content — let the user type their own question.

  const relations = result.relations;
  const out: SuggestedQuestion[] = [];
  const usedClaimIds = new Set<string>();
  let n = 0;
  const nextId = () => `sq-${++n}`;
  const push = (q: Omit<SuggestedQuestion, "id">) => {
    out.push({ id: nextId(), ...q });
    for (const seed of q.seedNodeIds) usedClaimIds.add(seed);
  };

  // Degree per claim index + incoming support edges (for TYPE C / centrality).
  const degree = new Array(claims.length).fill(0);
  const incomingSupport = new Map<number, number[]>();
  for (const rel of relations) {
    if (rel.from_index < claims.length) degree[rel.from_index]++;
    if (rel.to_index < claims.length) degree[rel.to_index]++;
    if (isSupportEdge(rel.relation_type) && rel.to_index < claims.length) {
      const list = incomingSupport.get(rel.to_index) ?? [];
      list.push(rel.from_index);
      incomingSupport.set(rel.to_index, list);
    }
  }

  // TYPE A — how two related ideas connect (no document names; both ideas stated plainly).
  const interDoc = relations.find(
    (r) =>
      r.from_index < claims.length &&
      r.to_index < claims.length &&
      r.from_index !== r.to_index &&
      sourceOf(claims, r.from_index) !== sourceOf(claims, r.to_index) &&
      sourceOf(claims, r.from_index) &&
      sourceOf(claims, r.to_index),
  );
  if (interDoc) {
    const a = claims[interDoc.from_index];
    const b = claims[interDoc.to_index];
    push({
      type: "A",
      question: `How does the view that ${prop(a.text)} relate to the claim that ${prop(b.text)}?`,
      seedNodeIds: [a.id, b.id],
    });
  }

  // TYPE B — contradiction stated as a genuine question (the model will tend to pick one side).
  const contradiction = relations.find(
    (r) =>
      /contradic/i.test(r.relation_type) &&
      r.from_index < claims.length &&
      r.to_index < claims.length,
  );
  if (contradiction) {
    const a = claims[contradiction.from_index];
    const b = claims[contradiction.to_index];
    push({
      type: "B",
      question: `Is it true that ${prop(a.text)}? And how does that square with the view that ${prop(b.text)}?`,
      seedNodeIds: [a.id, b.id],
    });
  }

  // TYPE C — evidence question (model gives a generic answer; graph gives the verified chain).
  const chainEntry = [...incomingSupport.entries()].find(([, froms]) => froms.length >= 3);
  if (chainEntry) {
    const [toIndex, froms] = chainEntry;
    const claim = claims[toIndex];
    push({
      type: "C",
      question: `What is the strongest evidence that ${prop(claim.text)}?`,
      seedNodeIds: [claim.id, ...froms.map((i) => claims[i]?.id).filter(Boolean)],
    });
  }

  // TYPE D — weak/contested claim (model often presents it as settled; graph flags the weakness).
  const weakIndex = claims.findIndex((c, i) => c.verification_category === "weak" && degree[i] > 0);
  if (weakIndex !== -1) {
    const claim = claims[weakIndex];
    const related = relations
      .filter((r) => r.from_index === weakIndex || r.to_index === weakIndex)
      .map((r) => (r.from_index === weakIndex ? r.to_index : r.from_index))
      .map((i) => claims[i]?.id)
      .filter(Boolean);
    push({
      type: "D",
      question: `How well-supported is the claim that ${prop(claim.text)}?`,
      seedNodeIds: [claim.id, ...related],
    });
  }

  // TYPE E — most-central concept (model gives a textbook answer; graph draws on the web of relations).
  let centralIndex = 0;
  for (let i = 1; i < claims.length; i++) {
    if (degree[i] > degree[centralIndex]) centralIndex = i;
  }
  const centralClaim = claims[centralIndex];
  const domain = domainName(claims);
  push({
    type: "E",
    question: domain
      ? `What is the significance of ${prop(centralClaim.text)} in ${domain}?`
      : `Why does it matter whether ${prop(centralClaim.text)}?`,
    seedNodeIds: [centralClaim.id],
  });

  // Fill remaining slots with claim-derived questions (highest-degree, not yet used).
  const byDegree = claims
    .map((c, i) => ({ c, i }))
    .sort((a, b) => degree[b.i] - degree[a.i]);
  for (const { c } of byDegree) {
    if (out.length >= 5) break;
    if (usedClaimIds.has(c.id)) continue;
    push({ type: "generic", question: `Is it true that ${prop(c.text)}?`, seedNodeIds: [c.id] });
  }

  return out.slice(0, 5);
}

function isSupportEdge(relationType: string): boolean {
  const t = relationType.toLowerCase();
  return t.includes("support") || t.includes("depends");
}

function sourceOf(claims: RetrievalResult["claims"], index: number): string {
  return claims[index]?.source_title ?? "";
}

function domainName(claims: RetrievalResult["claims"]): string {
  const counts = new Map<string, number>();
  for (const c of claims) {
    const d = (c.domain ?? "").trim();
    if (d && d.toLowerCase() !== "other" && d.toLowerCase() !== "unknown") {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  let best = "";
  let bestCount = 0;
  for (const [d, count] of counts) {
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Render a claim as a clause that reads naturally mid-question: trim, strip a trailing period,
 * and truncate to 60 chars. (Capitalisation is left intact to avoid mangling proper nouns.)
 */
function prop(text: string): string {
  const trimmed = text.trim().replace(/[.\s]+$/, "");
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 60).trimEnd()}…`;
}
