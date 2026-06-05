/**
 * SOPHIA — Argument-Aware Retrieval
 *
 * Core differentiator: not just semantic similarity, but graph traversal
 * that assembles complete argumentative chains from the knowledge graph.
 *
 * Retrieval pipeline:
 *   1. Embed query via Voyage AI
 *   2. Vector search for top-K semantically similar claims
 *   3. Graph traversal for each seed claim (depends_on, supports, contradicts, responds_to, defines, qualifies, part_of)
 *   4. Deduplicate claims
 *   5. Resolve inter-claim relations
 *   6. Fetch argument structure (conclusion + key premises)
 *   7. Return assembled RetrievalResult
 *
 * Graceful degradation: never throws — returns empty result on any failure
 * so the three-pass engine can still work without the graph.
 */

import type { GraphRagDeps, GraphStore } from './ports.js';
import {
	philosophyRetrievalConfig,
	type RetrievalConfig,
	type ThinkerContext,
	type VerificationCategory,
} from './config.js';
import {
	detectCorpusLevelQuery,
	extractLexicalTerms,
	fuseHybridCandidates
} from './hybrid-candidate-generation.js';
import {
	isRetrievalKgBalanceEnabled,
} from './kg-balance.js';
import { constructSeedSet, type SeedBalanceStats } from './seed-set-constructor.js';
import {
	fetchBm25ClaimCandidates,
	fetchNativeGraphNeighbors,
	fetchPassageGroundedClaimIds,
	fetchTaxonomySeedClaimIds,
	isRetrievalPassageGroundedEnabled,
	isRetrievalTaxonomyRoutingEnabled,
	isRetrievalBm25Enabled
} from './surreal-retrieval-enhancements.js';

/** SurrealDB KNN: `<|k,ef|>` — ef tunes HNSW/ANN search breadth (see Surreal vector docs). */
function retrievalDenseKnnEf(): number {
	const raw = (process.env.RETRIEVAL_KNN_EF ?? '64').trim();
	const n = parseInt(raw, 10);
	if (!Number.isFinite(n)) return 64;
	return Math.max(16, Math.min(512, n));
}

function surrealKnnOperator(k: number): string {
	const kk = Math.max(1, Math.trunc(k));
	const ef = retrievalDenseKnnEf();
	return `<|${kk},${ef}|>`;
}

// ─── Verification policy (Phase 2 — first-class, per-query trust filtering) ──

/**
 * Per-query trust filter. Defaults to supported-only with flagged claims excluded —
 * Restormel's trust promise. Opt into weaker evidence explicitly.
 */
export interface VerificationPolicy {
	/** Trust categories to include (default: `['supported']`). */
	include: VerificationCategory[];
	/** Optional trust-score floor, 0–100; claims with a lower score are dropped. */
	minTrustScore?: number;
	/** Exclude flagged claims regardless of `include` (default: true). */
	excludeFlagged?: boolean;
}

const DEFAULT_VERIFICATION_POLICY: Required<Pick<VerificationPolicy, 'include' | 'excludeFlagged'>> &
	VerificationPolicy = {
	include: ['supported'],
	excludeFlagged: true,
};

let envPolicyDeprecationLogged = false;

/** Resolve the effective policy, mapping the legacy env var to a default policy with a notice. */
function resolveVerificationPolicy(explicit: VerificationPolicy | undefined): VerificationPolicy {
	if (explicit) {
		return {
			include: explicit.include.length > 0 ? explicit.include : DEFAULT_VERIFICATION_POLICY.include,
			minTrustScore: explicit.minTrustScore,
			excludeFlagged: explicit.excludeFlagged ?? true,
		};
	}
	const raw = (process.env.RETRIEVAL_REQUIRE_VERIFIED ?? '').trim().toLowerCase();
	if (raw === '1' || raw === 'true' || raw === 'yes') {
		if (!envPolicyDeprecationLogged) {
			console.warn(
				'[RETRIEVAL] RETRIEVAL_REQUIRE_VERIFIED is deprecated; pass options.verificationPolicy instead. ' +
					'Mapping to { include: ["supported"], excludeFlagged: true }.'
			);
			envPolicyDeprecationLogged = true;
		}
	}
	return { ...DEFAULT_VERIFICATION_POLICY };
}

function sqlStringList(values: string[]): string {
	return `[${values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(', ')}]`;
}

/** Classify a claim's verification_state into a trust category using the config vocabulary. */
function classifyVerification(
	verificationState: string | null | undefined,
	vconfig: RetrievalConfig['verification']
): VerificationCategory {
	const state = (verificationState ?? '').trim();
	if (state && vconfig.supportedStates.includes(state)) return 'supported';
	if (state && vconfig.flaggedStates.includes(state)) return 'unsupported';
	return 'weak';
}

/** True when a claim of the given category + trust score is admitted by the policy. */
function policyAdmits(
	category: VerificationCategory,
	trustScore: number | null | undefined,
	policy: VerificationPolicy
): boolean {
	if (category === 'unsupported' && policy.excludeFlagged) return false;
	if (!policy.include.includes(category)) return false;
	if (
		policy.minTrustScore !== undefined &&
		typeof trustScore === 'number' &&
		trustScore < policy.minTrustScore
	) {
		return false;
	}
	return true;
}

/** Build the SQL WHERE predicate for the seed query from the policy + config vocabulary. */
function buildVerificationSqlPredicate(
	policy: VerificationPolicy,
	vconfig: RetrievalConfig['verification']
): string {
	const supported = sqlStringList(vconfig.supportedStates);
	const flagged = sqlStringList(vconfig.flaggedStates);
	const buckets: string[] = [];
	if (policy.include.includes('supported')) {
		buckets.push(`verification_state IN ${supported}`);
	}
	if (policy.include.includes('weak')) {
		buckets.push(
			`(verification_state = NONE OR (verification_state NOT IN ${supported} AND verification_state NOT IN ${flagged}))`
		);
	}
	if (policy.include.includes('unsupported') && !policy.excludeFlagged) {
		buckets.push(`verification_state IN ${flagged}`);
	}
	let predicate = buckets.length > 0 ? `(${buckets.join(' OR ')})` : `false`;
	if (policy.excludeFlagged) {
		predicate = `${predicate} AND (verification_state = NONE OR verification_state NOT IN ${flagged})`;
	}
	if (policy.minTrustScore !== undefined) {
		predicate = `${predicate} AND (trust_score = NONE OR trust_score >= ${policy.minTrustScore})`;
	}
	return predicate;
}

// ─── Result interfaces ─────────────────────────────────────────────────────

export interface RetrievedClaim {
	id: string;
	text: string;
	claim_type: string;
	domain: string;
	source_title: string;
	source_author: string[];
	confidence: number;
	position_in_source: number;
	/** Raw verification state from the graph (e.g. 'validated' | 'flagged' | null). */
	verification_state?: string | null;
	/** Trust score 0–100 when the graph supplies one. */
	trust_score?: number | null;
	/** Trust category derived from `verification_state` via the active config. */
	verification_category?: VerificationCategory;
}

export interface RetrievedRelation {
	from_index: number;
	to_index: number;
	relation_type: string;
	strength?: string;
	note?: string;
}

export interface RetrievedArgument {
	id: string;
	name: string;
	tradition: string | null;
	domain: string;
	summary: string;
	conclusion_text: string | null;
	key_premises: string[];
}

export type { ThinkerContext, ThinkerSummary } from './config.js';

export type RejectedClaimReasonCode =
	| 'seed_pool_pruned'
	| 'duplicate_traversal'
	| 'confidence_gate'
	| 'source_integrity_gate';
export type RejectedRelationReasonCode = 'duplicate_relation' | 'missing_endpoint';

export interface RejectedClaimCandidate {
	id: string;
	text: string;
	source_title: string;
	confidence?: number;
	reason_code: RejectedClaimReasonCode;
	considered_in: 'seed_pool' | 'traversal';
	anchor_claim_id?: string;
}

export interface RejectedRelationCandidate {
	from_claim_id: string;
	to_claim_id: string;
	relation_type: string;
	reason_code: RejectedRelationReasonCode;
	strength?: string;
	note?: string;
}

export interface ClosureUnitTrace {
	thesis_claim_id: string;
	objection_claim_id?: string;
	reply_claim_id?: string;
	objection_found: boolean;
	reply_found: boolean;
	unit_complete: boolean;
}

export interface RetrievalClosureStats {
	major_thesis_count: number;
	units_attempted: number;
	units_completed: number;
	claims_added_for_closure: number;
	objections_added: number;
	replies_added: number;
	cap_limited_units: number;
	units: ClosureUnitTrace[];
}

export interface RetrievalSeedTrace {
	id: string;
	claim_type: string;
	domain: string;
	source_title: string;
	confidence: number;
}

export interface RetrievalQueryDecompositionTrace {
	focus_mode: 'corpus_overview' | 'focused';
	domain_filter?: string;
	hybrid_mode: 'auto' | 'dense_only';
	corpus_level_query: boolean;
	lexical_terms: string[];
	lexical_term_count: number;
}

export interface RetrievalPruningSummaryTrace {
	claims_by_reason: Record<RejectedClaimReasonCode, number>;
	relations_by_reason: Record<RejectedRelationReasonCode, number>;
}

export interface RetrievalVerificationSummary {
	policy: {
		include: VerificationCategory[];
		min_trust_score?: number;
		exclude_flagged: boolean;
	};
	/** Counts of claims in the returned set, by trust category. */
	included: Record<VerificationCategory, number>;
	/** Counts of candidate claims dropped by the verification policy, by trust category. */
	excluded: Record<VerificationCategory, number>;
}

export interface RetrievalResult {
	claims: RetrievedClaim[];
	relations: RetrievedRelation[];
	arguments: RetrievedArgument[];
	seed_claim_ids: string[];
	evidence_passages?: Array<{ passage_id: string; excerpt: string; claim_ids: string[] }>;
	thinker_context?: ThinkerContext | null;
	trace?: {
		seed_pool_count: number;
		selected_seed_count: number;
		hybrid_mode?: 'auto' | 'dense_only';
		dense_seed_count?: number;
		lexical_seed_count?: number;
		lexical_terms?: string[];
		corpus_level_query?: boolean;
		seed_balance_stats?: SeedBalanceStats;
		traversal_mode?: string;
		traversal_max_hops?: number;
		traversal_hop_decay?: number;
		traversal_base_confidence_threshold?: number;
		traversal_confidence_thresholds?: number[];
		traversal_domain_aware?: boolean;
		traversal_trusted_edges_only?: boolean;
		traversal_edge_priors?: Partial<Record<string, number>>;
		query_decomposition?: RetrievalQueryDecompositionTrace;
		seed_claims?: RetrievalSeedTrace[];
		pruning_summary?: RetrievalPruningSummaryTrace;
		verification_summary?: RetrievalVerificationSummary;
		traversed_claim_count: number;
		relation_candidate_count: number;
		relation_kept_count: number;
		argument_candidate_count: number;
		argument_kept_count: number;
		closure_stats?: RetrievalClosureStats;
		rejected_claims?: RejectedClaimCandidate[];
		rejected_relations?: RejectedRelationCandidate[];
	};
	degraded: boolean;
	degraded_reason?: string;
}

export interface RetrievalOptions {
	/** Number of seed claims from vector search (default: 5) */
	topK?: number;
	/** Filter by philosophical domain */
	domain?: string;
	/** Minimum confidence threshold for claims (default: 0) */
	minConfidence?: number;
	/** Optional override for graph traversal depth (hops from seed claims) */
	maxHops?: number;
	/** Optional cap on total claims returned after traversal */
	maxClaims?: number;
	/** Optional retrieval mode override for baseline comparisons */
	hybridMode?: 'auto' | 'dense_only';
	/** Optional viewer context for trace/audit routing */
	viewerUid?: string | null;
	/** Opt-in thinker graph enrichment for retrieved claim context */
	enrichWithThinkerContext?: boolean;
	/**
	 * Per-query trust filter. Defaults to supported-only (flagged excluded).
	 * Opt into weak/unsupported evidence explicitly. See {@link VerificationPolicy}.
	 */
	verificationPolicy?: VerificationPolicy;
	/** Skip hybrid seeding; start traversal from these claim ids (get_context_for). */
	forcedSeedClaimIds?: string[];
	/**
	 * Domain pack driving taxonomy, edge priors, traversal tuning, enrichment and presentation.
	 * Defaults to {@link philosophyRetrievalConfig} so omitting it preserves SOPHIA's behaviour.
	 */
	config?: RetrievalConfig;
}

const EMPTY_RESULT: RetrievalResult = {
	claims: [],
	relations: [],
	arguments: [],
	seed_claim_ids: [],
	thinker_context: null,
	degraded: false
};

function defaultNormalizeClaimType(claimType: string): string {
	return claimType.trim().toLowerCase();
}

/** True when `claimType` matches any entry in `list` under the config normaliser. */
function claimTypeMatches(
	claimType: string,
	list: string[],
	normalize: (t: string) => string
): boolean {
	const norm = normalize(claimType);
	return list.some((entry) => normalize(entry) === norm);
}

function selectMajorThesisIds(params: {
	claims: RetrievedClaim[];
	seedClaimIds: string[];
	limit: number;
	taxonomy: RetrievalConfig['claimTaxonomy'];
}): string[] {
	const { claims, seedClaimIds, limit, taxonomy } = params;
	if (claims.length === 0 || limit <= 0) return [];
	const normalize = taxonomy.normalize ?? defaultNormalizeClaimType;

	const seedSet = new Set(seedClaimIds);
	const thesisClaims = claims
		.filter((claim) => claimTypeMatches(claim.claim_type, taxonomy.thesisTypes, normalize))
		.sort((a, b) => {
			const aSeed = seedSet.has(a.id) ? 1 : 0;
			const bSeed = seedSet.has(b.id) ? 1 : 0;
			if (aSeed !== bSeed) return bSeed - aSeed;
			return (b.confidence ?? 0) - (a.confidence ?? 0);
		});
	if (thesisClaims.length > 0) {
		return thesisClaims.slice(0, limit).map((claim) => claim.id);
	}

	// Fallback when claim typing is sparse: treat top seed/supportive claims as thesis anchors.
	const fallbackClaims = claims
		.filter((claim) =>
			claimTypeMatches(claim.claim_type, taxonomy.thesisFallbackTypes, normalize)
		)
		.sort((a, b) => {
			const aSeed = seedSet.has(a.id) ? 1 : 0;
			const bSeed = seedSet.has(b.id) ? 1 : 0;
			if (aSeed !== bSeed) return bSeed - aSeed;
			return (b.confidence ?? 0) - (a.confidence ?? 0);
		});
	return fallbackClaims.slice(0, limit).map((claim) => claim.id);
}

function computeHopConfidenceThreshold(
	baseThreshold: number,
	hop: number,
	hc: RetrievalConfig['traversal']['hopConfidence']
): number {
	const clampedBase = Math.max(hc.baseFloor, Math.min(hc.baseCeil, baseThreshold));
	return Math.max(hc.floor, Math.min(hc.ceil, clampedBase + (hop - 1) * hc.perHopIncrement));
}

function computeDomainExpansionWeight(
	params: {
		targetDomain?: string;
		anchorDomain?: string;
		neighborDomain?: string;
	},
	w: RetrievalConfig['traversal']['domainExpansionWeights']
): number {
	const { targetDomain, anchorDomain, neighborDomain } = params;
	if (targetDomain && neighborDomain === targetDomain) return w.sameTarget;
	if (targetDomain && neighborDomain && neighborDomain !== targetDomain) return w.offTarget;
	if (anchorDomain && neighborDomain && neighborDomain === anchorDomain) return w.sameAnchor;
	if (anchorDomain && neighborDomain && neighborDomain !== anchorDomain) return w.offAnchor;
	return w.neutral;
}

function parseRelationStrengthWeight(
	strength: string | undefined,
	w: RetrievalConfig['relations']['strengthWeights']
): number {
	if (!strength) return w.default;
	const normalized = strength.toLowerCase();
	if (normalized === 'strong') return w.strong;
	if (normalized === 'weak') return w.weak;
	return w.default;
}

// ─── Main retrieval function ───────────────────────────────────────────────

/**
 * Retrieve structured philosophical context from the argument graph.
 *
 * Assembles complete argumentative chains by:
 * 1. Finding semantically similar claims via vector search
 * 2. Traversing the graph for supporting/contradicting/dependent claims
 * 3. Resolving arguments those claims participate in
 *
 * Never throws — returns empty result on any failure.
 */
export async function retrieveContext(
	userQuery: string,
	deps: GraphRagDeps,
	options: RetrievalOptions = {}
): Promise<RetrievalResult> {
	const { store, embedder, resolveOriginBucket } = deps;
	const {
		topK = 5,
		domain,
		minConfidence = 0,
		maxHops,
		maxClaims,
		hybridMode = 'auto',
		enrichWithThinkerContext = false
	} = options;
	const config = options.config ?? philosophyRetrievalConfig;
	const schema = config.schema;
	const normalizeType = config.claimTaxonomy.normalize ?? defaultNormalizeClaimType;
	const verificationPolicy = resolveVerificationPolicy(options.verificationPolicy);
	const verificationExcluded: Record<VerificationCategory, number> = {
		supported: 0,
		weak: 0,
		unsupported: 0
	};
	/** Pure policy check (no counting). */
	const verificationAllows = (claim: {
		verification_state?: string | null;
		trust_score?: number | null;
	}): boolean =>
		policyAdmits(
			classifyVerification(claim.verification_state, config.verification),
			claim.trust_score ?? null,
			verificationPolicy
		);
	/** Classify a claim and check the policy; count + reject when not admitted. */
	const admitVerification = (claim: {
		verification_state?: string | null;
		trust_score?: number | null;
	}): boolean => {
		if (!verificationAllows(claim)) {
			verificationExcluded[classifyVerification(claim.verification_state, config.verification)] += 1;
			return false;
		}
		return true;
	};
	/** Verification provenance fields attached to every RetrievedClaim. */
	const verificationFields = (
		verification_state?: string | null,
		trust_score?: number | null
	): Pick<RetrievedClaim, 'verification_state' | 'trust_score' | 'verification_category'> => ({
		verification_state: verification_state ?? null,
		trust_score: trust_score ?? null,
		verification_category: classifyVerification(verification_state, config.verification)
	});
	const traversalMaxHops = Math.max(1, maxHops ?? config.traversal.defaultMaxHops(topK));
	const traversalClaimCap = Math.max(topK, maxClaims ?? config.traversal.defaultClaimCap(topK));

	try {
		// ── Step 1: Embed the query ──────────────────────────────────
		let queryEmbedding: number[];
		try {
			console.log('[RETRIEVAL] Embedding query:', userQuery.substring(0, 50) + '...');
			queryEmbedding = await embedder.embedQuery(userQuery);
			console.log('[RETRIEVAL] ✓ Query embedding received:', queryEmbedding.length, 'dimensions');
		} catch (err) {
			console.error('[RETRIEVAL] Embedding API failed:', err instanceof Error ? err.message : err);
			return {
				...EMPTY_RESULT,
				degraded: true,
				degraded_reason: 'embedding_unavailable'
			};
		}

		// ── Step 2: Hybrid candidate generation (dense + lexical) ───
		// Dense path: vector index (HNSW or MTREE) + KNN `<|k,ef|>`.
		// Lexical path: exact-term matching for philosophy-specific phrases.
		// Fusion: reciprocal-rank fusion + lightweight rerank.
		const densePool = domain || minConfidence > 0 ? topK * 4 : topK * 3;
		const lexicalTerms =
			hybridMode === 'dense_only' ? [] : extractLexicalTerms(userQuery, config.lexical.knownPhrases);
		const corpusLevelQuery =
			hybridMode === 'dense_only'
				? false
				: detectCorpusLevelQuery(userQuery, config.lexical.corpusLevelSignals);
		const queryDecomposition: RetrievalQueryDecompositionTrace = {
			focus_mode: corpusLevelQuery ? 'corpus_overview' : 'focused',
			domain_filter: domain,
			hybrid_mode: hybridMode,
			corpus_level_query: corpusLevelQuery,
			lexical_terms: lexicalTerms.slice(0, 16),
			lexical_term_count: lexicalTerms.length
		};
		const lexicalPool = lexicalTerms.length === 0 ? 0 : corpusLevelQuery ? topK * 8 : topK * 4;
		const acceptedClaimRows = await store.query<Array<{ count?: number }>>(
			`SELECT count() AS count FROM ${schema.unitTable} WHERE review_state = 'accepted' GROUP ALL`
		).catch(() => []);
		const trustedGraphActive = (acceptedClaimRows[0]?.count ?? 0) > 0;
		const claimReviewFilter = trustedGraphActive
			? `review_state = 'accepted'`
			: `(review_state = NONE OR review_state IN ['candidate', 'needs_review', 'accepted'])`;
		const relationReviewFilter = trustedGraphActive
			? `review_state = 'accepted'`
			: `(review_state = NONE OR review_state IN ['candidate', 'needs_review', 'accepted'])`;
		// Stage 3.2: traversal beam only follows trusted edges.
		const traversalRelationReviewFilter = `review_state = 'accepted'`;
		const argumentClaimReviewFilter = trustedGraphActive
			? `in.review_state = 'accepted'`
			: `(in.review_state = NONE OR in.review_state IN ['candidate', 'needs_review', 'accepted'])`;
		const postFilters: string[] = [];
		if (domain) postFilters.push('domain = $domain');
		if (minConfidence > 0) postFilters.push('confidence >= $minConfidence');
		postFilters.push(claimReviewFilter);
		postFilters.push(buildVerificationSqlPredicate(verificationPolicy, config.verification));
		const postWhere = postFilters.length > 0 ? `WHERE ${postFilters.join(' AND ')}` : '';

		type SeedRow = {
			id: string;
			text: string;
			claim_type: string;
			domain: string;
			confidence: number;
			embedding?: number[] | null;
			position_in_source: number;
			review_state?: string;
			verification_state?: string | null;
			trust_score?: number | null;
			section_context: string | null;
			source_id: string;
			source_url?: string | null;
			source_source_type?: string | null;
			source_title: string;
			source_author: string[];
		};

		const sourcePassageIntegrityCache = new Map<string, Promise<boolean>>();
		const sourceIdPart = (sourceId: string): string =>
			sourceId.includes(':') ? sourceId.split(':').slice(1).join(':') : sourceId;
		const sourceHasPassageCoverage = (sourceId?: string): Promise<boolean> => {
			if (!sourceId) return Promise.resolve(false);
			const existing = sourcePassageIntegrityCache.get(sourceId);
			if (existing) return existing;
			const pending = (async () => {
				const sid = sourceIdPart(sourceId);
				const passageRows = await store.query<Array<{ id: string }>>(
					`SELECT id FROM ${schema.passageTable} WHERE source = type::record('${schema.sourceTable}', $sid) LIMIT 1`,
					{ sid }
				).catch(() => []);
				return passageRows.length > 0;
			})();
			sourcePassageIntegrityCache.set(sourceId, pending);
			return pending;
		};

		let seedClaims: SeedRow[];
		let seedPoolCount = 0;
		const rejectedClaimsByKey = new Map<string, RejectedClaimCandidate>();
		const rejectedRelations: RejectedRelationCandidate[] = [];

		const addRejectedClaim = (candidate: RejectedClaimCandidate): void => {
			const key = `${candidate.id}|${candidate.reason_code}`;
			if (rejectedClaimsByKey.has(key)) return;
			rejectedClaimsByKey.set(key, candidate);
		};

		const rowProjection = `SELECT
			id,
			text,
			claim_type,
			domain,
			confidence,
			embedding,
			position_in_source,
			review_state,
			verification_state,
			trust_score,
			section_context,
			source.id AS source_id,
			source.url AS source_url,
			source.source_type AS source_source_type,
			source.title AS source_title,
			source.author AS source_author`;

		const sharedParams: Record<string, unknown> = {
			...(domain ? { domain } : {}),
			...(minConfidence > 0 ? { minConfidence } : {})
		};

		let denseSeedClaims: SeedRow[] = [];
		let lexicalSeedClaims: SeedRow[] = [];

		try {
			const knnOp = surrealKnnOperator(densePool);
			console.log('[RETRIEVAL] Dense candidate generation topK=', topK, 'knn=', knnOp);
			const denseSurql = (op: string) =>
				`${rowProjection}
				FROM (
					SELECT *
					FROM ${schema.unitTable}
					WHERE embedding ${op} $query_embedding
				)
				${postWhere}
				LIMIT ${densePool}`;
			const denseParams = {
				query_embedding: queryEmbedding,
				...sharedParams
			};
			try {
				denseSeedClaims = await store.query<SeedRow[]>(denseSurql(knnOp), denseParams);
			} catch (knnErr) {
				const legacyOp = `<|${Math.max(1, Math.trunc(densePool))}|>`;
				console.warn(
					'[RETRIEVAL] KNN two-arg operator failed; retrying legacy',
					legacyOp,
					knnErr instanceof Error ? knnErr.message : knnErr
				);
				denseSeedClaims = await store.query<SeedRow[]>(denseSurql(legacyOp), denseParams);
			}
			console.log('[RETRIEVAL] ✓ Dense candidates:', denseSeedClaims?.length || 0);
		} catch (dbErr) {
			if (store.isDatabaseUnavailable(dbErr)) {
				console.warn('[RETRIEVAL] Database unavailable during dense candidate retrieval');
				return {
					...EMPTY_RESULT,
					degraded: true,
					degraded_reason: 'database_unavailable'
				};
			}
			throw dbErr;
		}

		if (hybridMode !== 'dense_only' && lexicalPool > 0) {
			try {
				const lexicalTermClauses = lexicalTerms.map(
					(_term, idx) => `(text ~ $term_${idx} OR section_context ~ $term_${idx})`
				);
				const lexicalWhere = `WHERE (${lexicalTermClauses.join(' OR ')}) AND ${postFilters.join(
					' AND '
				)}`;
				const lexicalParams: Record<string, unknown> = { ...sharedParams };
				for (const [idx, term] of lexicalTerms.entries()) {
					lexicalParams[`term_${idx}`] = term;
				}

				lexicalSeedClaims = await store.query<SeedRow[]>(
					`${rowProjection}
					FROM ${schema.unitTable}
					${lexicalWhere}
					ORDER BY confidence DESC
					LIMIT ${lexicalPool}`,
					lexicalParams
				);

				if (isRetrievalBm25Enabled() && lexicalTerms.length > 0) {
					const bm25Rows = await fetchBm25ClaimCandidates(store, {
						terms: lexicalTerms,
						limit: lexicalPool,
						reviewFilter: postFilters.join(' AND '),
						unitTable: schema.unitTable
					});
					if (bm25Rows.length > 0) {
						const existing = new Set(lexicalSeedClaims.map((r) => String(r.id)));
						for (const row of bm25Rows) {
							if (existing.has(String(row.id))) continue;
							lexicalSeedClaims.push({
								id: row.id,
								text: row.text,
								claim_type: config.domain.fallbackClaimType,
								domain: config.domain.fallbackDomain,
								confidence: row.confidence ?? 0.5,
								position_in_source: 0,
								section_context: null,
								source_id: '',
								source_title: 'Unknown',
								source_author: []
							});
						}
					}
				}

				console.log(
					'[RETRIEVAL] ✓ Lexical candidates:',
					lexicalSeedClaims?.length || 0,
					'terms=',
					lexicalTerms.length
				);
			} catch (lexicalErr) {
				console.warn(
					'[RETRIEVAL] Lexical candidate generation failed (continuing with dense only):',
					lexicalErr instanceof Error ? lexicalErr.message : lexicalErr
				);
			}
		}

		if (isRetrievalTaxonomyRoutingEnabled() && lexicalTerms.length > 0) {
			try {
				const taxonomyIds = await fetchTaxonomySeedClaimIds(store, {
					terms: lexicalTerms,
					limit: Math.max(4, topK),
					reviewFilter: postFilters.join(' AND '),
					unitTable: schema.unitTable
				});
				if (taxonomyIds.length > 0) {
					const taxonomyRows = await store.query<SeedRow[]>(
						`${rowProjection}
						FROM ${schema.unitTable}
						WHERE id INSIDE $ids AND ${postFilters.join(' AND ')}
						LIMIT $limit`,
						{ ids: taxonomyIds, limit: taxonomyIds.length }
					);
					const existing = new Set([
						...denseSeedClaims.map((r) => String(r.id)),
						...lexicalSeedClaims.map((r) => String(r.id))
					]);
					for (const row of taxonomyRows ?? []) {
						if (existing.has(String(row.id))) continue;
						denseSeedClaims.push(row);
						existing.add(String(row.id));
					}
					console.log('[RETRIEVAL] ✓ Taxonomy-routed seeds:', taxonomyRows?.length ?? 0);
				}
			} catch (taxonomyErr) {
				console.warn(
					'[RETRIEVAL] Taxonomy routing failed (continuing):',
					taxonomyErr instanceof Error ? taxonomyErr.message : taxonomyErr
				);
			}
		}

		let passageGroundedClaimIds: string[] = [];
		if (isRetrievalPassageGroundedEnabled()) {
			try {
				passageGroundedClaimIds = await fetchPassageGroundedClaimIds(store, {
					queryEmbedding,
					limit: Math.max(4, topK),
					reviewFilter: postFilters.join(' AND '),
						unitTable: schema.unitTable,
						passageTable: schema.passageTable,
						groundedInEdge: schema.groundedInEdge
				});
				if (passageGroundedClaimIds.length > 0) {
					const passageRows = await store.query<SeedRow[]>(
						`${rowProjection}
						FROM ${schema.unitTable}
						WHERE id INSIDE $ids AND ${postFilters.join(' AND ')}
						LIMIT $limit`,
						{ ids: passageGroundedClaimIds, limit: passageGroundedClaimIds.length }
					);
					const existing = new Set([
						...denseSeedClaims.map((r) => String(r.id)),
						...lexicalSeedClaims.map((r) => String(r.id))
					]);
					for (const row of passageRows ?? []) {
						if (existing.has(String(row.id))) continue;
						denseSeedClaims.push(row);
						existing.add(String(row.id));
					}
					console.log('[RETRIEVAL] ✓ Passage-grounded seeds:', passageRows?.length ?? 0);
				}
			} catch (passageErr) {
				console.warn(
					'[RETRIEVAL] Passage-grounded retrieval failed (continuing):',
					passageErr instanceof Error ? passageErr.message : passageErr
				);
			}
		}

		if (options.forcedSeedClaimIds && options.forcedSeedClaimIds.length > 0) {
			const forcedRows = await store.query<SeedRow[]>(
				`${rowProjection}
				FROM ${schema.unitTable}
				WHERE id INSIDE $ids AND ${postFilters.join(' AND ')}
				LIMIT $limit`,
				{ ids: options.forcedSeedClaimIds, limit: options.forcedSeedClaimIds.length, ...sharedParams }
			);
			seedClaims = forcedRows ?? [];
			seedPoolCount = seedClaims.length;
			if (seedClaims.length === 0) {
				return {
					...EMPTY_RESULT,
					degraded: true,
					degraded_reason: 'seed_claim_not_found'
				};
			}
		} else if ((!denseSeedClaims || denseSeedClaims.length === 0) && lexicalSeedClaims.length === 0) {
			console.log('[RETRIEVAL] No candidates found in dense or lexical retrieval');
			return EMPTY_RESULT;
		} else if (hybridMode === 'dense_only') {
			seedClaims = denseSeedClaims;
			seedPoolCount = denseSeedClaims.length;
		} else {
			const fusion = fuseHybridCandidates({
				dense: denseSeedClaims,
				lexical: lexicalSeedClaims,
				lexicalTerms,
				poolSize: Math.max(topK * 4, topK),
				corpusLevelQuery
			});
			seedClaims = fusion.ranked;
			seedPoolCount = fusion.fusedCount;
		}

		if (!seedClaims || seedClaims.length === 0) {
			console.log('[RETRIEVAL] Hybrid fusion returned no candidates');
			return EMPTY_RESULT;
		}

		console.log(
			`[RETRIEVAL] Candidate generation mode=${hybridMode} dense=${denseSeedClaims.length} lexical=${lexicalSeedClaims.length} fused=${seedPoolCount} corpusLevel=${corpusLevelQuery}`
		);

		const seedPool = [...seedClaims];
		const vettedSeedPool: SeedRow[] = [];
		for (const seed of seedPool) {
			// Verification policy (defense in depth — the seed SQL also pre-filters by policy).
			if (!admitVerification(seed)) continue;
			const sourceOk = await sourceHasPassageCoverage(seed.source_id);
			if (!sourceOk) {
				addRejectedClaim({
					id: typeof seed.id === 'object' ? String(seed.id) : seed.id,
					text: seed.text,
					source_title: seed.source_title ?? 'Unknown',
					confidence: seed.confidence,
					reason_code: 'source_integrity_gate',
					considered_in: 'seed_pool'
				});
				continue;
			}
			vettedSeedPool.push(seed);
		}
		if (vettedSeedPool.length === 0) {
			return {
				...EMPTY_RESULT,
				degraded: true,
				degraded_reason: 'source_integrity_gate'
			};
		}

		const domainsInPool = new Set<string>();
		for (const s of vettedSeedPool) {
			domainsInPool.add(String(s.domain ?? 'unknown'));
		}

		const seedSet = constructSeedSet<SeedRow>({
			candidates: vettedSeedPool,
			topK,
			queryEmbedding,
			roles: config.seedRoles,
			...(config.originBalance.enabled && isRetrievalKgBalanceEnabled()
				? {
						kgBalance: {
							idealOrigin: config.originBalance.idealFractions,
							originStrength: config.originBalance.originStrength,
							domainStrength: config.originBalance.domainStrength,
							domainsInPool,
							getOrigin: (c) =>
								resolveOriginBucket(c.source_url ?? null, c.source_source_type ?? null),
							getDomainKey: (c) => String(c.domain ?? 'unknown')
						}
					}
				: {})
		});
		seedClaims = seedSet.seeds;

		console.log(`[RETRIEVAL] Found ${seedClaims.length} seed claims`);
		const seedClaimIds = seedClaims.map((seed) =>
			typeof seed.id === 'object' ? String(seed.id) : seed.id
		);
		const seedTrace: RetrievalSeedTrace[] = seedClaims.map((seed) => ({
			id: typeof seed.id === 'object' ? String(seed.id) : seed.id,
			claim_type: seed.claim_type,
			domain: seed.domain,
			source_title: seed.source_title ?? 'Unknown',
			confidence: seed.confidence ?? 0
		}));
		const selectedSeedIds = new Set(seedClaimIds);
		for (const candidate of vettedSeedPool) {
			const candidateId = typeof candidate.id === 'object' ? String(candidate.id) : candidate.id;
			if (selectedSeedIds.has(candidateId)) continue;
			addRejectedClaim({
				id: candidateId,
				text: candidate.text,
				source_title: candidate.source_title ?? 'Unknown',
				confidence: candidate.confidence,
				reason_code: 'seed_pool_pruned',
				considered_in: 'seed_pool'
			});
		}

		// ── Step 3: Graph traversal for each seed claim ──────────────
		// Collect all claim IDs and argument IDs discovered via traversal
		type GraphClaim = {
			id: string;
			text: string;
			claim_type: string;
			domain: string;
			confidence: number;
			position_in_source: number;
			review_state?: string;
			verification_state?: string | null;
			trust_score?: number | null;
			source: { id?: string; title: string; author: string[] } | string;
		};

		type TraversalEdgeRow = {
			in: string;
			out: string;
			in_claim?: GraphClaim;
			out_claim?: GraphClaim;
			strength?: string;
			note?: string;
		};

		const allGraphClaims: Map<string, RetrievedClaim> = new Map();
		const argumentIds: Set<string> = new Set();

		// Add seed claims to the map first
		for (const seed of seedClaims) {
			const id = typeof seed.id === 'object' ? String(seed.id) : seed.id;
			allGraphClaims.set(id, {
				id,
				text: seed.text,
				claim_type: seed.claim_type,
				domain: seed.domain,
				source_title: seed.source_title ?? 'Unknown',
				source_author: seed.source_author ?? [],
				confidence: seed.confidence,
				position_in_source: seed.position_in_source ?? 0,
				...verificationFields(seed.verification_state, seed.trust_score)
			});
		}

		const resolveSource = (claim: GraphClaim): { id?: string; title: string; author: string[] } => {
			if (claim.source && typeof claim.source === 'object' && 'title' in claim.source) {
				return {
					id: (claim.source as { id?: string }).id,
					title: (claim.source as { title: string }).title,
					author: (claim.source as { author: string[] }).author ?? []
				};
			}
			return { title: 'Unknown', author: [] };
		};

		const toClaimId = (idValue: unknown): string | null => {
			if (!idValue) return null;
			if (typeof idValue === 'string') return idValue;
			return String(idValue);
		};
		const claimProjection =
			`{id, text, claim_type, domain, confidence, position_in_source, review_state, verification_state, trust_score, source.{id, title, author}}`;
		const passesTraversalClaimGate = (claim: GraphClaim): boolean => {
			if (claim.review_state === 'rejected' || claim.review_state === 'merged') return false;
			if (trustedGraphActive && claim.review_state !== 'accepted') return false;
			// Verification policy (Phase 2): counts excluded candidates by trust category.
			if (!admitVerification(claim)) return false;
			return true;
		};

		const maxNewClaimsPerHop = config.traversal.beam.newPerHop(topK);
		const beamWidthPerHop = config.traversal.beam.width(topK);
		const beamQueryLimitPerTable = config.traversal.beam.queryLimitPerTable(topK);
		const hopDecayFactor = traversalMaxHops <= 1 ? 1 : config.traversal.hopDecayFactor;
		const traversalBaseConfidence =
			minConfidence > 0 ? Math.max(0.3, Math.min(0.8, minConfidence)) : config.traversal.baseConfidence;
		const traversalConfidenceThresholds = Array.from({ length: traversalMaxHops }, (_, idx) =>
			computeHopConfidenceThreshold(traversalBaseConfidence, idx + 1, config.traversal.hopConfidence)
		);
		let frontier = new Set(seedClaimIds);
		const nativeNeighborIds = await fetchNativeGraphNeighbors(store, {
			seedIds: seedClaimIds,
			limit: Math.max(16, topK * 4),
			unitTable: schema.unitTable,
			relationEdges: config.relations.traversalEdges.map((edge) => edge.table)
		});
		for (const neighborId of nativeNeighborIds) {
			frontier.add(neighborId);
		}

		for (let hop = 1; hop <= traversalMaxHops; hop++) {
			if (frontier.size === 0 || allGraphClaims.size >= traversalClaimCap) break;

			const frontierIds = Array.from(frontier);
			const frontierSet = new Set(frontierIds);
			const hopConfidenceThreshold =
				traversalConfidenceThresholds[hop - 1] ?? traversalBaseConfidence;
			const hopDecay = Math.pow(hopDecayFactor, hop - 1);
			const hopCandidates = new Map<
				string,
				{
					claim: GraphClaim;
					anchorId: string;
					score: number;
				}
			>();

			for (const spec of config.relations.traversalEdges) {
				try {
					const rows = await store.query<TraversalEdgeRow[]>(
						`SELECT
							in,
							out,
							in.${claimProjection} AS in_claim,
							out.${claimProjection} AS out_claim,
							strength,
							note
						FROM ${spec.table}
						WHERE (in INSIDE $frontier_ids OR out INSIDE $frontier_ids) AND ${traversalRelationReviewFilter}
						LIMIT ${beamQueryLimitPerTable}`,
						{ frontier_ids: frontierIds }
					);
					if (!rows || !Array.isArray(rows)) continue;

					const registerBeamCandidate = (params: {
						anchorId: string;
						neighbor?: GraphClaim;
						strength?: string;
						edgePrior: number;
					}): void => {
						const { anchorId, neighbor, strength, edgePrior } = params;
						if (!neighbor) return;
						const neighborId = toClaimId(neighbor.id);
						if (!neighborId) return;
						const source = resolveSource(neighbor);

						if (!passesTraversalClaimGate(neighbor)) return;
						if ((neighbor.confidence ?? 0) < hopConfidenceThreshold) {
							addRejectedClaim({
								id: neighborId,
								text: neighbor.text,
								source_title: source.title,
								confidence: neighbor.confidence,
								reason_code: 'confidence_gate',
								considered_in: 'traversal',
								anchor_claim_id: anchorId
							});
							return;
						}
						if (allGraphClaims.has(neighborId)) {
							addRejectedClaim({
								id: neighborId,
								text: neighbor.text,
								source_title: source.title,
								confidence: neighbor.confidence,
								reason_code: 'duplicate_traversal',
								considered_in: 'traversal',
								anchor_claim_id: anchorId
							});
							return;
						}

						const anchor = allGraphClaims.get(anchorId);
						const domainWeight = config.domain.enabled
							? computeDomainExpansionWeight(
									{
										targetDomain: domain,
										anchorDomain: anchor?.domain,
										neighborDomain: neighbor.domain
									},
									config.traversal.domainExpansionWeights
								)
							: 1;
						const strengthWeight = parseRelationStrengthWeight(
							strength,
							config.relations.strengthWeights
						);
						const anchorWeight = 0.7 + 0.3 * (anchor?.confidence ?? 0.6);
						const score =
							Math.max(0.01, neighbor.confidence ?? 0.5) *
							edgePrior *
							hopDecay *
							domainWeight *
							strengthWeight *
							anchorWeight;

						const existing = hopCandidates.get(neighborId);
						if (!existing || score > existing.score) {
							hopCandidates.set(neighborId, {
								claim: neighbor,
								anchorId,
								score
							});
						}
					};

					for (const row of rows) {
						const inId = toClaimId(row.in);
						const outId = toClaimId(row.out);
						if (!inId || !outId) continue;
						if (frontierSet.has(inId)) {
							registerBeamCandidate({
								anchorId: inId,
								neighbor: row.out_claim,
								strength: row.strength,
								edgePrior: spec.edgePrior
							});
						}
						if (frontierSet.has(outId)) {
							registerBeamCandidate({
								anchorId: outId,
								neighbor: row.in_claim,
								strength: row.strength,
								edgePrior: spec.edgePrior
							});
						}
					}
				} catch (traversalErr) {
					console.warn(
						`[RETRIEVAL] Beam traversal failed for ${spec.table}:`,
						traversalErr instanceof Error ? traversalErr.message : traversalErr
					);
				}
			}

			const candidates = Array.from(hopCandidates.values())
				.sort((a, b) => b.score - a.score)
				.slice(0, beamWidthPerHop);
			const selected: Array<{ claim: GraphClaim; anchorId: string }> = [];
			const seenSources = new Set<string>();
			const hopBudget = Math.min(
				maxNewClaimsPerHop,
				Math.max(traversalClaimCap - allGraphClaims.size, 0)
			);

			for (const candidate of candidates) {
				if (selected.length >= hopBudget) break;
				const source = resolveSource(candidate.claim);
				if (!(await sourceHasPassageCoverage(source.id))) {
					addRejectedClaim({
						id:
							typeof candidate.claim.id === 'object'
								? String(candidate.claim.id)
								: candidate.claim.id,
						text: candidate.claim.text,
						source_title: source.title,
						confidence: candidate.claim.confidence,
						reason_code: 'source_integrity_gate',
						considered_in: 'traversal',
						anchor_claim_id: candidate.anchorId
					});
					continue;
				}
				const sourceTitle = source.title;
				if (seenSources.has(sourceTitle)) continue;
				seenSources.add(sourceTitle);
				selected.push(candidate);
			}
			for (const candidate of candidates) {
				if (selected.length >= hopBudget) break;
				if (selected.includes(candidate)) continue;
				const source = resolveSource(candidate.claim);
				if (!(await sourceHasPassageCoverage(source.id))) {
					addRejectedClaim({
						id:
							typeof candidate.claim.id === 'object'
								? String(candidate.claim.id)
								: candidate.claim.id,
						text: candidate.claim.text,
						source_title: source.title,
						confidence: candidate.claim.confidence,
						reason_code: 'source_integrity_gate',
						considered_in: 'traversal',
						anchor_claim_id: candidate.anchorId
					});
					continue;
				}
				selected.push(candidate);
			}

			const nextFrontier = new Set<string>();
			for (const { claim } of selected) {
				const cId = typeof claim.id === 'object' ? String(claim.id) : claim.id;
				const source = resolveSource(claim);
				allGraphClaims.set(cId, {
					id: cId,
					text: claim.text,
					claim_type: claim.claim_type,
					domain: claim.domain,
					source_title: source.title,
					source_author: source.author,
					confidence: claim.confidence ?? 0.5,
					position_in_source: claim.position_in_source ?? 0,
					...verificationFields(claim.verification_state, claim.trust_score)
				});
				nextFrontier.add(cId);
			}
			const selectedClaimIds = Array.from(nextFrontier);
			if (selectedClaimIds.length > 0) {
				try {
					const argRefs = await store.query<Array<{ arg_id?: string | { id?: string } }>>(
						`SELECT out.id AS arg_id FROM ${config.arguments.membershipEdge} WHERE in INSIDE $claim_ids LIMIT 200`,
						{ claim_ids: selectedClaimIds }
					);
					if (argRefs && Array.isArray(argRefs)) {
						for (const row of argRefs) {
							const aId = toClaimId(row.arg_id);
							if (aId) argumentIds.add(aId);
						}
					}
				} catch (argRefErr) {
					console.warn(
						'[RETRIEVAL] Beam traversal argument lookup failed:',
						argRefErr instanceof Error ? argRefErr.message : argRefErr
					);
				}
			}
			console.log(
				`[RETRIEVAL] hop ${hop}/${traversalMaxHops}: candidates=${candidates.length} threshold=${hopConfidenceThreshold.toFixed(
					2
				)} added=${selected.length} frontier=${nextFrontier.size}`
			);
			frontier = nextFrontier;
		}

		// Add argument-neighborhood claims so traversal can surface complete
		// argument structures (conclusions + key premises), not only local edges.
		if (argumentIds.size > 0 && allGraphClaims.size < traversalClaimCap) {
			type ArgumentMemberRow = {
				in: {
					id: string;
					text: string;
					claim_type: string;
					domain: string;
					confidence: number;
					position_in_source: number;
					review_state?: string;
					verification_state?: string | null;
					trust_score?: number | null;
					source: { id?: string; title: string; author: string[] } | string;
				};
				role: string;
			};

			try {
				const memberRows = await store.query<ArgumentMemberRow[]>(
					`SELECT
						in.{id, text, claim_type, domain, confidence, position_in_source, review_state, verification_state, trust_score, source.{id, title, author}} AS in,
						role
					FROM ${config.arguments.membershipEdge}
					WHERE out INSIDE $arg_ids AND ${argumentClaimReviewFilter}`,
					{ arg_ids: Array.from(argumentIds) }
				);

				if (memberRows && Array.isArray(memberRows)) {
					const roleRank = (role: string): number =>
						config.arguments.membershipRoleRank[role] ?? 3;
					const sorted = [...memberRows].sort((a, b) => {
						const rankDelta = roleRank(a.role) - roleRank(b.role);
						if (rankDelta !== 0) return rankDelta;
						return (b.in?.confidence ?? 0) - (a.in?.confidence ?? 0);
					});

					for (const row of sorted) {
						if (allGraphClaims.size >= traversalClaimCap) break;
						if (!row.in) continue;
						const claim = row.in;
						if (claim.review_state === 'rejected' || claim.review_state === 'merged') continue;
						if (trustedGraphActive && claim.review_state !== 'accepted') continue;
						if (!admitVerification(claim)) continue;
						const cId = typeof claim.id === 'object' ? String(claim.id) : claim.id;
						if (allGraphClaims.has(cId)) continue;
						const source =
							claim.source && typeof claim.source === 'object' && 'title' in claim.source
								? {
										id: (claim.source as { id?: string }).id,
										title: (claim.source as { title: string }).title,
										author: (claim.source as { author: string[] }).author ?? []
									}
								: { title: 'Unknown', author: [] };
						if (!(await sourceHasPassageCoverage(source.id))) {
							addRejectedClaim({
								id: cId,
								text: claim.text,
								source_title: source.title,
								confidence: claim.confidence,
								reason_code: 'source_integrity_gate',
								considered_in: 'traversal'
							});
							continue;
						}

						allGraphClaims.set(cId, {
							id: cId,
							text: claim.text,
							claim_type: claim.claim_type,
							domain: claim.domain,
							source_title: source.title,
							source_author: source.author,
							confidence: claim.confidence ?? 0.5,
							position_in_source: claim.position_in_source ?? 0,
							...verificationFields(claim.verification_state, claim.trust_score)
						});
					}
				}
			} catch (argNeighborhoodErr) {
				console.warn(
					'[RETRIEVAL] Failed to expand argument-neighborhood claims:',
					argNeighborhoodErr instanceof Error ? argNeighborhoodErr.message : argNeighborhoodErr
				);
			}
		}

		// ── Stage 3.1: Closure enforcement (thesis -> objection -> reply) ──
		// For each major thesis, try to ensure at least one objection and one reply
		// are present in the assembled retrieval set when the graph supports it.
		type RelationNeighborRow = {
			in_claim?: GraphClaim;
			out_claim?: GraphClaim;
		};
		const contradictionNeighborCache = new Map<string, Promise<GraphClaim[]>>();
		const replyNeighborCache = new Map<string, Promise<GraphClaim[]>>();
		const majorThesisLimit = config.closure.enabled ? config.closure.maxMajorTheses(topK) : 0;
		const majorThesisIds = selectMajorThesisIds({
			claims: Array.from(allGraphClaims.values()),
			seedClaimIds,
			limit: majorThesisLimit,
			taxonomy: config.claimTaxonomy
		});
		let closureClaimsAdded = 0;
		let closureObjectionsAdded = 0;
		let closureRepliesAdded = 0;
		let closureCapLimitedUnits = 0;
		const closureUnits: ClosureUnitTrace[] = [];

		const passesClosureReviewGate = (claim: GraphClaim): boolean => {
			if (claim.review_state === 'rejected' || claim.review_state === 'merged') return false;
			if (trustedGraphActive && claim.review_state !== 'accepted') return false;
			if (!verificationAllows(claim)) return false;
			return true;
		};

		const hasClosurePassageCoverage = async (
			claim: GraphClaim,
			anchorClaimId: string
		): Promise<boolean> => {
			const source = resolveSource(claim);
			const covered = await sourceHasPassageCoverage(source.id);
			if (covered) return true;
			addRejectedClaim({
				id: typeof claim.id === 'object' ? String(claim.id) : claim.id,
				text: claim.text,
				source_title: source.title,
				confidence: claim.confidence,
				reason_code: 'source_integrity_gate',
				considered_in: 'traversal',
				anchor_claim_id: anchorClaimId
			});
			return false;
		};

		type ClosureAttachResult = 'present' | 'added' | 'blocked_cap' | 'blocked_source';
		const attachClaimForClosure = async (
			claim: GraphClaim,
			anchorClaimId: string
		): Promise<ClosureAttachResult> => {
			const claimId = typeof claim.id === 'object' ? String(claim.id) : claim.id;
			if (allGraphClaims.has(claimId)) return 'present';
			if (allGraphClaims.size >= traversalClaimCap) return 'blocked_cap';
			if (!(await hasClosurePassageCoverage(claim, anchorClaimId))) return 'blocked_source';

			const source = resolveSource(claim);
			allGraphClaims.set(claimId, {
				id: claimId,
				text: claim.text,
				claim_type: claim.claim_type,
				domain: claim.domain,
				source_title: source.title,
				source_author: source.author,
				confidence: claim.confidence ?? 0.5,
				position_in_source: claim.position_in_source ?? 0,
				...verificationFields(claim.verification_state, claim.trust_score)
			});
			return 'added';
		};

		const fetchRelationNeighbors = async (
			table: string,
			claimId: string,
			cache: Map<string, Promise<GraphClaim[]>>
		): Promise<GraphClaim[]> => {
			const cached = cache.get(claimId);
			if (cached) return cached;
			const pending = (async () => {
				try {
					const rows = await store.query<RelationNeighborRow[]>(
						`SELECT
							in.${claimProjection} AS in_claim,
							out.${claimProjection} AS out_claim
						FROM ${table}
						WHERE (in = $claim_id OR out = $claim_id) AND ${relationReviewFilter}
						LIMIT 24`,
						{ claim_id: claimId }
					);
					if (!rows || !Array.isArray(rows)) return [];

					const byId = new Map<string, GraphClaim>();
					for (const row of rows) {
						const inClaim = row.in_claim;
						const outClaim = row.out_claim;
						if (!inClaim || !outClaim) continue;

						const inId = toClaimId(inClaim.id);
						const outId = toClaimId(outClaim.id);
						const neighbor =
							inId === claimId ? outClaim : outId === claimId ? inClaim : undefined;
						if (!neighbor) continue;
						const neighborId = toClaimId(neighbor.id);
						if (!neighborId) continue;
						const existing = byId.get(neighborId);
						if (!existing || (neighbor.confidence ?? 0) > (existing.confidence ?? 0)) {
							byId.set(neighborId, neighbor);
						}
					}
					return Array.from(byId.values()).sort(
						(a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
					);
				} catch (err) {
					console.warn(
						`[RETRIEVAL] Closure lookup failed for ${table} on ${claimId}:`,
						err instanceof Error ? err.message : err
					);
					return [];
				}
			})();
			cache.set(claimId, pending);
			return pending;
		};

		const pickClosureCandidate = async (
			candidates: GraphClaim[],
			anchorClaimId: string,
			matcher: (claimType: string) => boolean
		): Promise<GraphClaim | null> => {
			if (candidates.length === 0) return null;
			for (const requireTypedMatch of [true, false]) {
				for (const candidate of candidates) {
					if (!passesClosureReviewGate(candidate)) continue;
					if (requireTypedMatch && !matcher(candidate.claim_type)) continue;
					const candidateId = typeof candidate.id === 'object' ? String(candidate.id) : candidate.id;
					if (allGraphClaims.has(candidateId)) return candidate;
					if (await hasClosurePassageCoverage(candidate, anchorClaimId)) {
						return candidate;
					}
				}
			}
			return null;
		};

		for (const thesisId of majorThesisIds) {
			const unit: ClosureUnitTrace = {
				thesis_claim_id: thesisId,
				objection_found: false,
				reply_found: false,
				unit_complete: false
			};
			let capLimitedInUnit = false;
			const thesisExists = allGraphClaims.has(thesisId);
			if (!thesisExists) {
				closureUnits.push(unit);
				continue;
			}

			const contradictionNeighbors = await fetchRelationNeighbors(
				config.relations.contradictionEdge,
				thesisId,
				contradictionNeighborCache
			);
			const objectionCandidate = await pickClosureCandidate(
				contradictionNeighbors,
				thesisId,
				(ct) => claimTypeMatches(ct, config.claimTaxonomy.objectionTypes, normalizeType)
			);
			if (objectionCandidate) {
				const objectionId =
					typeof objectionCandidate.id === 'object'
						? String(objectionCandidate.id)
						: objectionCandidate.id;
				const objectionAttach = await attachClaimForClosure(objectionCandidate, thesisId);
				if (objectionAttach === 'added') {
					closureClaimsAdded += 1;
					closureObjectionsAdded += 1;
				}
				if (objectionAttach === 'blocked_cap') {
					capLimitedInUnit = true;
				}
				if (objectionAttach === 'added' || objectionAttach === 'present') {
					unit.objection_found = true;
					unit.objection_claim_id = objectionId;

					const replyNeighbors = await fetchRelationNeighbors(
						config.relations.replyEdge,
						objectionId,
						replyNeighborCache
					);
					const replyCandidate = await pickClosureCandidate(
						replyNeighbors,
						objectionId,
						(ct) => claimTypeMatches(ct, config.claimTaxonomy.replyTypes, normalizeType)
					);
					if (replyCandidate) {
						const replyId =
							typeof replyCandidate.id === 'object'
								? String(replyCandidate.id)
								: replyCandidate.id;
						const replyAttach = await attachClaimForClosure(replyCandidate, objectionId);
						if (replyAttach === 'added') {
							closureClaimsAdded += 1;
							closureRepliesAdded += 1;
						}
						if (replyAttach === 'blocked_cap') {
							capLimitedInUnit = true;
						}
						if (replyAttach === 'added' || replyAttach === 'present') {
							unit.reply_found = true;
							unit.reply_claim_id = replyId;
						}
					}
				}
			}

			unit.unit_complete = unit.objection_found && unit.reply_found;
			if (capLimitedInUnit) closureCapLimitedUnits += 1;
			closureUnits.push(unit);
		}

		const closureStats: RetrievalClosureStats = {
			major_thesis_count: majorThesisIds.length,
			units_attempted: majorThesisIds.length,
			units_completed: closureUnits.filter((unit) => unit.unit_complete).length,
			claims_added_for_closure: closureClaimsAdded,
			objections_added: closureObjectionsAdded,
			replies_added: closureRepliesAdded,
			cap_limited_units: closureCapLimitedUnits,
			units: closureUnits
		};
		console.log('[RETRIEVAL] Closure enforcement', {
			major_theses: closureStats.major_thesis_count,
			units_completed: closureStats.units_completed,
			claims_added: closureStats.claims_added_for_closure
		});

		// ── Step 4: Build deduplicated claims array ──────────────────
		const claims = Array.from(allGraphClaims.values());
		const claimIdToIndex = new Map<string, number>();
		claims.forEach((c, i) => claimIdToIndex.set(c.id, i));

		console.log(`[RETRIEVAL] ${claims.length} unique claims after graph traversal`);

		// ── Step 5: Resolve relations between claims in result set ───
		const relations: RetrievedRelation[] = [];
		const claimIds = claims.map((c) => c.id);
		let relationCandidateCount = 0;
		const keptRelationKeys = new Set<string>();

		if (claimIds.length >= 2) {
			type RelRow = {
				in: string;
				out: string;
				relation_type: string;
				strength?: string;
				note?: string;
			};

			for (const { table, relationType } of config.relations.fetchEdges) {
				try {
					const rels = await store.query<RelRow[]>(
						`SELECT in, out, $table AS relation_type, strength, note
						FROM ${table}
						WHERE in INSIDE $ids AND out INSIDE $ids AND ${relationReviewFilter}`,
						{ ids: claimIds, table }
					);

						if (rels && Array.isArray(rels)) {
							relationCandidateCount += rels.length;
							for (const rel of rels) {
								const fromId = typeof rel.in === 'object' ? String(rel.in) : rel.in;
								const toId = typeof rel.out === 'object' ? String(rel.out) : rel.out;
								const fromIdx = claimIdToIndex.get(fromId);
								const toIdx = claimIdToIndex.get(toId);

								if (fromIdx === undefined || toIdx === undefined) {
									rejectedRelations.push({
										from_claim_id: fromId,
										to_claim_id: toId,
										relation_type: relationType,
										reason_code: 'missing_endpoint',
										strength: rel.strength,
										note: rel.note
									});
									continue;
								}

								const relationKey = `${fromIdx}|${toIdx}|${relationType}`;
								if (keptRelationKeys.has(relationKey)) {
									rejectedRelations.push({
										from_claim_id: fromId,
										to_claim_id: toId,
										relation_type: relationType,
										reason_code: 'duplicate_relation',
										strength: rel.strength,
										note: rel.note
									});
									continue;
								}

								keptRelationKeys.add(relationKey);
								relations.push({
									from_index: fromIdx,
									to_index: toIdx,
									relation_type: relationType,
									strength: rel.strength,
									note: rel.note
								});
							}
						}
					} catch (relErr) {
					console.warn(
						`[RETRIEVAL] Failed to query ${table} relations:`,
						relErr instanceof Error ? relErr.message : relErr
					);
				}
			}
		}

		console.log(`[RETRIEVAL] ${relations.length} relations among retrieved claims`);

		// ── Step 6: Fetch argument structures ────────────────────────
		const arguments_: RetrievedArgument[] = [];

		for (const argId of argumentIds) {
			try {
				type ArgRow = {
					id: string;
					name: string;
					tradition: string | null;
					domain: string;
					summary: string;
					member_claims: Array<{
						text: string;
						role: string;
					}>;
				};

				const argRows = await store.query<ArgRow[]>(
					`SELECT
						*,
						<-${config.arguments.membershipEdge}<-${schema.unitTable}.{text, role: <-${config.arguments.membershipEdge}[WHERE out = $arg_id].role} AS member_claims
					FROM $arg_id`,
					{ arg_id: argId }
				);

				if (!argRows || argRows.length === 0) continue;

				const arg = Array.isArray(argRows) ? argRows[0] : argRows;

				// Try a simpler approach to get member claims with roles
				let conclusionText: string | null = null;
				const keyPremises: string[] = [];

				// Fetch part_of relations pointing to this argument
				type PartOfRow = {
					in: string;
					role: string;
					claim_text?: string;
				};

				const partOfRels = await store.query<PartOfRow[]>(
					`SELECT in, role, in.text AS claim_text
					FROM ${config.arguments.membershipEdge}
					WHERE out = $arg_id`,
					{ arg_id: argId }
				);

				if (partOfRels && Array.isArray(partOfRels)) {
					for (const po of partOfRels) {
						if (po.role === config.arguments.conclusionRole && po.claim_text) {
							conclusionText = po.claim_text;
						} else if (po.role === config.arguments.keyPremiseRole && po.claim_text) {
							keyPremises.push(po.claim_text);
						}
					}
				}

				arguments_.push({
					id: typeof arg.id === 'object' ? String(arg.id) : arg.id,
					name: arg.name,
					tradition: arg.tradition,
					domain: arg.domain as string,
					summary: arg.summary,
					conclusion_text: conclusionText,
					key_premises: keyPremises
				});
			} catch (argErr) {
				console.warn(
					`[RETRIEVAL] Failed to fetch argument ${argId}:`,
					argErr instanceof Error ? argErr.message : argErr
				);
			}
		}

		console.log(`[RETRIEVAL] ${arguments_.length} arguments assembled`);
		let thinkerContext: ThinkerContext | null = null;
		if (enrichWithThinkerContext && config.entityEnrichment) {
			const claimIdsForThinkerContext = claims.map((claim) => claim.id).filter(Boolean);
			thinkerContext = await config.entityEnrichment.fetch(store, claimIdsForThinkerContext);
		}
		const traversalEdgePriors: Partial<Record<string, number>> = Object.fromEntries(
			config.relations.traversalEdges.map((spec) => [spec.table, spec.edgePrior])
		);
		const pruningSummary: RetrievalPruningSummaryTrace = {
			claims_by_reason: {
				seed_pool_pruned: 0,
				duplicate_traversal: 0,
				confidence_gate: 0,
				source_integrity_gate: 0
			},
			relations_by_reason: {
				duplicate_relation: 0,
				missing_endpoint: 0
			}
		};
		for (const rejected of rejectedClaimsByKey.values()) {
			pruningSummary.claims_by_reason[rejected.reason_code] += 1;
		}
		for (const rejected of rejectedRelations) {
			pruningSummary.relations_by_reason[rejected.reason_code] += 1;
		}

		const verificationIncluded: Record<VerificationCategory, number> = {
			supported: 0,
			weak: 0,
			unsupported: 0
		};
		for (const claim of claims) {
			verificationIncluded[
				claim.verification_category ??
					classifyVerification(claim.verification_state, config.verification)
			] += 1;
		}
		const verificationSummary: RetrievalVerificationSummary = {
			policy: {
				include: verificationPolicy.include,
				min_trust_score: verificationPolicy.minTrustScore,
				exclude_flagged: verificationPolicy.excludeFlagged ?? true
			},
			included: verificationIncluded,
			excluded: { ...verificationExcluded }
		};

		let evidencePassages: RetrievalResult['evidence_passages'];
		if (isRetrievalPassageGroundedEnabled() && passageGroundedClaimIds.length > 0) {
			try {
				const passageRows = await store.query<Array<{ id: string; text: string; claim_id?: string }>>(
					`SELECT passage.id AS id, passage.text AS text, in AS claim_id
					 FROM grounded_in
					 WHERE in INSIDE $claim_ids
					 FETCH passage
					 LIMIT 8`,
					{ claim_ids: claims.map((c) => c.id).slice(0, 24) }
				);
				evidencePassages = (passageRows ?? []).map((row) => ({
					passage_id: String(row.id),
					excerpt: (row.text ?? '').slice(0, 480),
					claim_ids: row.claim_id ? [String(row.claim_id)] : []
				}));
			} catch {
				evidencePassages = undefined;
			}
		}

		return {
			claims,
			relations,
			arguments: arguments_,
			seed_claim_ids: seedClaimIds,
			evidence_passages: evidencePassages,
			thinker_context: thinkerContext,
			trace: {
				seed_pool_count: seedPoolCount,
				selected_seed_count: seedClaimIds.length,
				hybrid_mode: hybridMode,
				dense_seed_count: denseSeedClaims.length,
				lexical_seed_count: lexicalSeedClaims.length,
				lexical_terms: lexicalTerms.slice(0, 8),
				corpus_level_query: corpusLevelQuery,
				seed_balance_stats: seedSet.stats,
				traversal_mode: config.traversal.mode,
				traversal_max_hops: traversalMaxHops,
				traversal_hop_decay: hopDecayFactor,
				traversal_base_confidence_threshold: traversalBaseConfidence,
				traversal_confidence_thresholds: traversalConfidenceThresholds,
				traversal_domain_aware: config.domain.enabled,
				traversal_trusted_edges_only: config.traversal.trustedEdgesOnly,
				traversal_edge_priors: traversalEdgePriors,
				query_decomposition: queryDecomposition,
				seed_claims: seedTrace,
				pruning_summary: pruningSummary,
				verification_summary: verificationSummary,
				traversed_claim_count: Math.max(claims.length - seedClaimIds.length, 0),
				relation_candidate_count: relationCandidateCount,
				relation_kept_count: relations.length,
				argument_candidate_count: argumentIds.size,
				argument_kept_count: arguments_.length,
				closure_stats: closureStats,
				rejected_claims: Array.from(rejectedClaimsByKey.values()).slice(0, 60),
				rejected_relations: rejectedRelations.slice(0, 80)
			},
			degraded: false
		};
	} catch (err) {
		// Top-level catch: SurrealDB unreachable, unexpected errors, etc.
		console.error(
			'[RETRIEVAL] Fatal retrieval error (returning empty result):',
			err instanceof Error ? err.message : err
		);
		return {
			...EMPTY_RESULT,
			degraded: true,
			degraded_reason: store.isDatabaseUnavailable(err) ? 'database_unavailable' : 'retrieval_error'
		};
	}
}

// ─── Context block formatter ───────────────────────────────────────────────

/**
 * Format a RetrievalResult into a structured text block for the LLM prompt.
 *
 * Returns a human-readable representation of the retrieved argument graph
 * that the model can use as grounding context for its three-pass analysis.
 */
export function buildContextBlock(
	result: RetrievalResult,
	config: RetrievalConfig = philosophyRetrievalConfig
): string {
	if (!result.claims || result.claims.length === 0) {
		return 'No knowledge base context available for this query.';
	}

	const lines: string[] = [];

	lines.push(config.presentation.header);
	lines.push('');
	lines.push(config.presentation.intro);
	lines.push('');

	// ── Claims with IDs and Relations ──
	for (let i = 0; i < result.claims.length; i++) {
		const c = result.claims[i];
		const claimId = `c:${String(i + 1).padStart(3, '0')}`;
		const authorStr = c.source_author?.length
			? c.source_author.join(', ')
			: 'Unknown';
		let verificationMark = '';
		if (config.presentation.annotateVerification) {
			const category =
				c.verification_category ?? classifyVerification(c.verification_state, config.verification);
			const trust = typeof c.trust_score === 'number' ? ` ${c.trust_score}` : '';
			verificationMark = ` [${category}${trust}]`;
		}
		lines.push(`CLAIM [${claimId}] (${c.claim_type}${verificationMark}, source: "${c.source_title}")`);
		lines.push(`"${c.text}"`);
		
		// Show relations from this claim
		const outgoingRelations = (result.relations ?? []).filter(r => r.from_index === i);
		if (outgoingRelations.length > 0) {
			for (const r of outgoingRelations) {
				const targetId = `c:${String(r.to_index + 1).padStart(3, '0')}`;
				const relType = r.relation_type.toUpperCase().replace(/_/g, ' ');
				const strengthStr = r.strength ? ` (${r.strength})` : '';
				lines.push(`  ├─ ${relType} [${targetId}]${strengthStr}`);
			}
		}
		lines.push('');
	}

	// ── Arguments ──
	if ((result.arguments ?? []).length > 0) {
		lines.push('NAMED ARGUMENTS:');
		for (const arg of result.arguments ?? []) {
			const traditionStr = arg.tradition ? ` (${arg.tradition})` : '';
			lines.push(`▸ ${arg.name}${traditionStr}`);
			lines.push(`  ${arg.summary}`);
			if (arg.conclusion_text) {
				lines.push(`  Conclusion: "${arg.conclusion_text}"`);
			}
			if (arg.key_premises.length > 0) {
				lines.push(`  Key premises: ${arg.key_premises.map((p) => `"${p}"`).join('; ')}`);
			}
			lines.push('');
		}
	}

	if (result.evidence_passages && result.evidence_passages.length > 0) {
		lines.push('EVIDENCE PASSAGES (source spans linked to retrieved claims):');
		for (const passage of result.evidence_passages) {
			lines.push(`▸ ${passage.passage_id}`);
			lines.push(`  "${passage.excerpt}"`);
			if (passage.claim_ids.length > 0) {
				lines.push(`  Linked claims: ${passage.claim_ids.join(', ')}`);
			}
			lines.push('');
		}
	}

	lines.push('=== END KNOWLEDGE GRAPH CONTEXT ===');
	lines.push('');
	lines.push(config.presentation.footer);

	return lines.join('\n');
}

/**
 * Graph traversal from a known claim id (topic supplements lexical context when provided).
 */
export async function retrieveContextFromSeed(
	seedClaimId: string,
	topic: string,
	deps: GraphRagDeps,
	options: RetrievalOptions = {}
): Promise<RetrievalResult> {
	const query = topic.trim() || seedClaimId;
	return retrieveContext(query, deps, {
		...options,
		forcedSeedClaimIds: [seedClaimId]
	});
}
