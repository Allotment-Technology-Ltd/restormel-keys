/**
 * Evidence Dossier service (W2.2) — claim-level "why is this trusted".
 *
 * Reads the EBV truth the pipeline already persists (evidence spans, verification
 * states, judgment audit trail, claim-version chains) and exposes it to the explorer:
 *   - per-unit summaries for the units API (Postgres spine + BYO Surreal),
 *   - the full dossier (source excerpt with the bound span located in context,
 *     judgment history, version ledger),
 *   - the deterministic Layer-1 re-check (verifyEvidenceSpan — no model, ledger row 9),
 *   - operator actions: accept (row-2 guard: unbound → never supported) and
 *     reversible soft-exclude (never hard-delete).
 */
import { contentHash, verifyEvidenceSpan, type EvidenceSpan } from "@restormel/connect-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import {
  canAcceptAsSupported,
  normalizeEvidenceStatus,
  normalizeVerificationState,
  predatesEvidenceBinding,
  type ConnectEvidenceDossier,
  type EvidenceExcerpt,
  type RecheckOutcome,
  type UnitEvidenceSummary,
} from "$lib/connect/evidence-dossier";
import {
  fetchSurrealSourceRecordText,
  resolveConnectSourceTextRaw,
  type ConnectSourceTextQuality,
} from "$lib/server/connect/connect-source-text-resolve";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import {
  formatSurrealRecordId,
  REMOVED_VALIDATION_STATUS,
  surrealRecordRef,
} from "$lib/server/connect/graph-writer";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { pickSurrealUnitText } from "$lib/server/connect/surreal-graph-units-load";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  getSql,
  ensureIngestionRoutingSchema,
  listConnectClaimEvidenceForUnitsPostgres,
  listConnectClaimVersionChainsForUnitsPostgres,
  listConnectDomainPacksForWorkspace,
  updateConnectClaimVersionStatesPostgres,
  updateUnitValidationPostgres,
  type ConnectClaimEvidenceRow,
} from "$lib/server/neon";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

// ── Pure composition (unit-testable without a store) ────────────────────────

/** Compose the units-API summary from a Postgres claim-version row. */
export function composeEvidenceSummaryFromPostgresRow(
  row: ConnectClaimEvidenceRow,
): UnitEvidenceSummary {
  const bound =
    row.evidenceStatus === "bound" &&
    row.evidenceQuote != null &&
    row.spanStart != null &&
    row.spanEnd != null;
  return {
    verificationState: normalizeVerificationState(row.verificationState),
    evidenceStatus: normalizeEvidenceStatus(row.evidenceStatus),
    evidence: bound
      ? {
          quote: row.evidenceQuote!,
          start: row.spanStart!,
          end: row.spanEnd!,
          match: row.evidenceMatch ?? "exact",
          sourceHash: row.sourceHash ?? "",
        }
      : null,
    judgedBy: row.judgedBy,
    judgedAt: row.judgedAt,
    judge: row.judgeModel || row.judgeVerdict
      ? {
          model: row.judgeModel,
          promptVersion: row.judgePromptVersion,
          verdict: row.judgeVerdict,
          confidence: row.judgeConfidence,
          judgedAt: row.judgeJudgedAt,
        }
      : null,
    versions: { count: row.versionCount, currentVersionNo: row.versionNo },
    boundAt: row.boundAt,
  };
}

/**
 * Compose the units-API summary from a Surreal unit record's EBV fields
 * (written by the ingest graph-writer). Returns null when the record carries
 * no EBV fields at all — the claim predates evidence binding.
 */
export function composeEvidenceSummaryFromSurrealRow(
  row: Record<string, unknown>,
): UnitEvidenceSummary | null {
  const verificationState = normalizeVerificationState(row.verification_state);
  const evidenceStatus = normalizeEvidenceStatus(row.evidence_status);
  if (verificationState == null && evidenceStatus == null) return null;

  const quote = typeof row.evidence_quote === "string" ? row.evidence_quote : null;
  const start = typeof row.evidence_start === "number" ? row.evidence_start : null;
  const end = typeof row.evidence_end === "number" ? row.evidence_end : null;
  const match = typeof row.evidence_match === "string" ? row.evidence_match : null;
  const sourceHash =
    typeof row.evidence_source_hash === "string" ? row.evidence_source_hash : null;
  const bound = evidenceStatus === "bound" && quote != null && start != null && end != null;
  const boundAt = typeof row.valid_from === "string" ? row.valid_from : null;

  return {
    verificationState,
    evidenceStatus,
    evidence: bound
      ? { quote, start, end, match: match ?? "exact", sourceHash: sourceHash ?? "" }
      : null,
    judgedBy: null,
    judgedAt: null,
    judge: null,
    versions: null,
    boundAt,
  };
}

const EXCERPT_CONTEXT_CHARS = 280;

/**
 * Locate the bound span inside the current source text for display: by recorded
 * offsets when they still hold, falling back to a verbatim search. Display-only —
 * the deterministic re-check (hash + offsets) is separate and never softened.
 */
export function buildEvidenceExcerpt(args: {
  sourceText: string;
  quote: string;
  start: number;
  end: number;
  contextChars?: number;
}): EvidenceExcerpt {
  const ctx = Math.max(40, args.contextChars ?? EXCERPT_CONTEXT_CHARS);
  const text = args.sourceText;
  if (!text) return { located: "none", reason: "source_text_unavailable" };

  const offsetsValid = args.start >= 0 && args.end > args.start && args.end <= text.length;
  if (offsetsValid) {
    const slice = text.slice(args.start, args.end);
    // Accept the offsets when the text there still resembles the quote
    // (exact, or whitespace-insensitive for normalized/fuzzy bindings).
    const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    if (slice === args.quote || fold(slice) === fold(args.quote) || slice.includes(args.quote)) {
      return {
        located: "offsets",
        before: text.slice(Math.max(0, args.start - ctx), args.start),
        quote: slice,
        after: text.slice(args.end, Math.min(text.length, args.end + ctx)),
      };
    }
  }

  const at = text.indexOf(args.quote);
  if (at >= 0) {
    return {
      located: "search",
      before: text.slice(Math.max(0, at - ctx), at),
      quote: text.slice(at, at + args.quote.length),
      after: text.slice(at + args.quote.length, Math.min(text.length, at + args.quote.length + ctx)),
    };
  }

  return { located: "none", reason: "quote_not_in_current_text" };
}

/**
 * Deterministic Layer-1 re-check against resolved source text (ledger rows 2/9):
 * tries the raw text and its trimmed form (some resolution paths trim), passing
 * only when a candidate's content hash matches AND the span still verifies.
 * No model involved — anyone can re-run this.
 */
export async function recheckEvidenceSpanAgainstText(args: {
  span: EvidenceSpan;
  sourceText: string | null;
  quality: ConnectSourceTextQuality;
}): Promise<RecheckOutcome> {
  const checkedAt = new Date().toISOString();
  if (!args.sourceText || args.quality !== "full") {
    return { ok: false, reason: "source_text_unavailable", checkedAt };
  }
  const candidates = [...new Set([args.sourceText, args.sourceText.trim()])];
  let lastFailure: RecheckOutcome | null = null;
  let sawHashMatch = false;
  for (const text of candidates) {
    const hash = await contentHash(text);
    if (hash !== args.span.source_hash) continue;
    sawHashMatch = true;
    const result = verifyEvidenceSpan({ span: args.span, sourceText: text, sourceHash: hash });
    if (result.ok) return { ok: true, match: result.match, checkedAt };
    lastFailure = { ok: false, reason: result.reason, checkedAt };
  }
  if (sawHashMatch && lastFailure) return lastFailure;
  return { ok: false, reason: "hash_mismatch", checkedAt };
}

// ── Unit + source context loading ────────────────────────────────────────────

type DossierUnitContext = {
  unitId: string;
  summary: UnitEvidenceSummary | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  sourcePreview: string | null;
  surrealFullText: string | null;
  store: "postgres" | "surreal";
  graphStore: GraphStore | null;
  unitTable: string | null;
};

async function resolvePack(
  workspaceId: string,
  domainPackId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  let packRecord = domainPackId
    ? await getConnectDomainPackById({ id: domainPackId, workspaceId })
    : null;
  if (!packRecord) {
    const packs = await listConnectDomainPacksForWorkspace(workspaceId);
    packRecord = packs.find((p) => p.slug === "generic") ?? packs[0] ?? null;
  }
  if (!packRecord) return null;
  try {
    return domainPackRecordToApi(packRecord);
  } catch {
    return null;
  }
}

async function loadPostgresDossierContext(
  workspaceId: string,
  unitId: string,
): Promise<DossierUnitContext | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, s.title AS source_title, s.url AS source_url,
           s.source_kind AS source_kind, s.text_preview AS source_preview
    FROM knowledge_graph_units u
    LEFT JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.id = ${unitId} AND u.workspace_id = ${workspaceId}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const evidenceRows = await listConnectClaimEvidenceForUnitsPostgres({
    workspaceId,
    unitIds: [unitId],
  });
  const summary = evidenceRows[0]
    ? composeEvidenceSummaryFromPostgresRow(evidenceRows[0])
    : null;
  return {
    unitId,
    summary,
    sourceTitle: row.source_title != null ? String(row.source_title) : null,
    sourceUrl: row.source_url != null ? String(row.source_url) : null,
    sourceKind: row.source_kind != null ? String(row.source_kind) : null,
    sourcePreview: row.source_preview != null ? String(row.source_preview) : null,
    surrealFullText: null,
    store: "postgres",
    graphStore: null,
    unitTable: null,
  };
}

function parseSurrealSourceRef(source: unknown): {
  key: string | null;
  title: string | null;
  url: string | null;
  kind: string | null;
  preview: string | null;
} {
  if (typeof source === "string" && source.includes(":")) {
    return { key: source, title: null, url: null, kind: null, preview: null };
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { key: null, title: null, url: null, kind: null, preview: null };
  }
  const s = source as Record<string, unknown>;
  return {
    key: formatSurrealRecordId(s.id) ?? (typeof s.id === "string" ? s.id : null),
    title: typeof s.title === "string" ? s.title : null,
    url: typeof s.url === "string" ? s.url : null,
    kind: typeof s.source_kind === "string" ? s.source_kind : null,
    preview: typeof s.text_preview === "string" ? s.text_preview : null,
  };
}

async function loadSurrealDossierContext(
  workspaceId: string,
  unitId: string,
  pack: ConnectDomainPack,
): Promise<DossierUnitContext | null> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  const unitTable = tableIdent(pack.graph_schema.unit_table, "unit");
  const ref = surrealRecordRef(unitId.includes(":") ? unitId : `${unitTable}:${unitId}`);
  let row: Record<string, unknown> | undefined;
  try {
    const rows = await store.query<Record<string, unknown>[]>(`SELECT * FROM ${ref} FETCH source;`);
    row = rows[0];
    if (!row) {
      const plain = await store.query<Record<string, unknown>[]>(`SELECT * FROM ${ref};`);
      row = plain[0];
    }
  } catch {
    return null;
  }
  if (!row || !pickSurrealUnitText(row)) return null;

  const fetched = parseSurrealSourceRef(row.source);
  let sourceTitle =
    (typeof row.source_title === "string" && row.source_title.trim()
      ? row.source_title.trim()
      : null) ?? fetched.title;
  let sourceUrl =
    (typeof row.source_url === "string" && row.source_url.trim() ? row.source_url.trim() : null) ??
    fetched.url;
  let sourcePreview = fetched.preview;
  let surrealFullText: string | null = null;
  if (fetched.key) {
    const hints = await fetchSurrealSourceRecordText(store, fetched.key, pack);
    sourceTitle = sourceTitle ?? hints.title;
    sourceUrl = sourceUrl ?? hints.url;
    sourcePreview = sourcePreview ?? hints.textPreview;
    surrealFullText = hints.fullText;
  }

  return {
    unitId: formatSurrealRecordId(row.id) ?? unitId,
    summary: composeEvidenceSummaryFromSurrealRow(row),
    sourceTitle,
    sourceUrl,
    sourceKind: typeof row.source_kind === "string" ? row.source_kind : fetched.kind,
    sourcePreview,
    surrealFullText,
    store: "surreal",
    graphStore: store,
    unitTable,
  };
}

async function loadDossierContext(
  workspaceId: string,
  unitId: string,
  domainPackId: string | null,
): Promise<DossierUnitContext | null> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (target?.provider === "surreal") {
    const pack = await resolvePack(workspaceId, domainPackId);
    if (!pack) return null;
    return loadSurrealDossierContext(workspaceId, unitId, pack);
  }
  return loadPostgresDossierContext(workspaceId, unitId);
}

// ── Dossier (GET) ────────────────────────────────────────────────────────────

export type { ConnectEvidenceDossier, EvidenceExcerpt } from "$lib/connect/evidence-dossier";

async function loadPostgresJudgments(
  workspaceId: string,
  unitId: string,
): Promise<ConnectEvidenceDossier["judgments"]> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT verdict, confidence, judge_model, prompt_version, judged_at, note
      FROM connect_claim_judgments
      WHERE workspace_id = ${workspaceId} AND unit_id = ${unitId}
      ORDER BY judged_at DESC, id DESC
      LIMIT 10
    `;
    return (rows as Record<string, unknown>[]).map((r) => ({
      verdict: String(r.verdict ?? ""),
      confidence: r.confidence == null ? null : Number(r.confidence),
      judgeModel: r.judge_model != null ? String(r.judge_model) : null,
      promptVersion: r.prompt_version == null ? null : Number(r.prompt_version),
      judgedAt:
        r.judged_at instanceof Date
          ? r.judged_at.toISOString()
          : r.judged_at != null
            ? String(r.judged_at)
            : null,
      note: r.note != null ? String(r.note) : null,
    }));
  } catch {
    return [];
  }
}

async function loadSurrealJudgments(
  store: GraphStore,
  unitId: string,
): Promise<ConnectEvidenceDossier["judgments"]> {
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT verdict, confidence, judge_model, prompt_version, judged_at, note
       FROM connect_claim_judgment WHERE unit = ${JSON.stringify(unitId)}
       ORDER BY judged_at DESC LIMIT 10;`,
    );
    return (rows ?? []).map((r) => ({
      verdict: String(r.verdict ?? ""),
      confidence: r.confidence == null ? null : Number(r.confidence),
      judgeModel: r.judge_model != null ? String(r.judge_model) : null,
      promptVersion: r.prompt_version == null ? null : Number(r.prompt_version),
      judgedAt: r.judged_at != null ? String(r.judged_at) : null,
      note: r.note != null ? String(r.note) : null,
    }));
  } catch {
    return [];
  }
}

async function loadPostgresVersions(
  workspaceId: string,
  unitId: string,
): Promise<ConnectEvidenceDossier["versions"]> {
  try {
    const chain = await listConnectClaimVersionChainsForUnitsPostgres({
      workspaceId,
      unitIds: [unitId],
    });
    if (chain.length === 0) return null;
    return chain.map((v) => ({
      versionNo: v.versionNo,
      verificationState: v.verificationState,
      validFrom: v.validFrom,
      validTo: v.validTo,
      superseded: v.supersededBy != null || v.validTo != null,
      current: v.validTo == null && v.unitId === unitId,
    }));
  } catch {
    return null;
  }
}

async function loadSurrealVersions(
  store: GraphStore,
  unitId: string,
): Promise<ConnectEvidenceDossier["versions"]> {
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT version_no, verification_state, valid_from, valid_to, superseded_by
       FROM restormel_claim_versions WHERE unit_id = ${JSON.stringify(unitId)}
       ORDER BY version_no ASC LIMIT 20;`,
    );
    if (!rows || rows.length === 0) return null;
    return rows.map((r) => ({
      versionNo: r.version_no == null ? 1 : Number(r.version_no),
      verificationState: r.verification_state != null ? String(r.verification_state) : null,
      validFrom: r.valid_from != null ? String(r.valid_from) : null,
      validTo: r.valid_to != null ? String(r.valid_to) : null,
      superseded: r.valid_to != null || r.superseded_by != null,
      current: r.valid_to == null,
    }));
  } catch {
    return null;
  }
}

export async function loadConnectEvidenceDossier(params: {
  workspaceId: string;
  unitId: string;
  domainPackId?: string | null;
}): Promise<
  | { ok: true; dossier: ConnectEvidenceDossier }
  | { ok: false; status: number; message: string }
> {
  const ctx = await loadDossierContext(
    params.workspaceId,
    params.unitId,
    params.domainPackId ?? null,
  );
  if (!ctx) {
    return { ok: false, status: 404, message: "Claim not found in your graph store." };
  }

  const summary = ctx.summary;
  const preEbv = predatesEvidenceBinding(summary);

  let excerpt: EvidenceExcerpt | null = null;
  let sourceTextQuality: ConnectSourceTextQuality = "missing";
  if (summary?.evidence) {
    const resolved = await resolveConnectSourceTextRaw({
      workspaceId: params.workspaceId,
      title: ctx.sourceTitle,
      url: ctx.sourceUrl,
      textPreview: ctx.sourcePreview,
      surrealFullText: ctx.surrealFullText,
    });
    sourceTextQuality = resolved.quality;
    excerpt =
      resolved.quality === "missing"
        ? { located: "none", reason: "source_text_unavailable" }
        : buildEvidenceExcerpt({
            sourceText: resolved.text,
            quote: summary.evidence.quote,
            start: summary.evidence.start,
            end: summary.evidence.end,
          });
  } else if (summary) {
    excerpt = { located: "none", reason: "no_bound_span" };
  }

  const [judgments, versions] = await Promise.all([
    ctx.store === "surreal" && ctx.graphStore
      ? loadSurrealJudgments(ctx.graphStore, ctx.unitId)
      : loadPostgresJudgments(params.workspaceId, params.unitId),
    ctx.store === "surreal" && ctx.graphStore
      ? loadSurrealVersions(ctx.graphStore, ctx.unitId)
      : loadPostgresVersions(params.workspaceId, params.unitId),
  ]);

  return {
    ok: true,
    dossier: {
      unitId: ctx.unitId,
      predatesEvidenceBinding: preEbv,
      summary,
      source: { title: ctx.sourceTitle, url: ctx.sourceUrl, kind: ctx.sourceKind },
      sourceTextQuality,
      excerpt,
      judgments,
      versions,
    },
  };
}

// ── Re-check (POST action: recheck) ─────────────────────────────────────────

export async function recheckConnectUnitEvidence(params: {
  workspaceId: string;
  unitId: string;
  domainPackId?: string | null;
}): Promise<
  | { ok: true; outcome: RecheckOutcome }
  | { ok: false; status: number; message: string }
> {
  const ctx = await loadDossierContext(
    params.workspaceId,
    params.unitId,
    params.domainPackId ?? null,
  );
  if (!ctx) {
    return { ok: false, status: 404, message: "Claim not found in your graph store." };
  }
  const evidence = ctx.summary?.evidence;
  if (!evidence) {
    return {
      ok: true,
      outcome: { ok: false, reason: "no_bound_span", checkedAt: new Date().toISOString() },
    };
  }
  const resolved = await resolveConnectSourceTextRaw({
    workspaceId: params.workspaceId,
    title: ctx.sourceTitle,
    url: ctx.sourceUrl,
    textPreview: ctx.sourcePreview,
    surrealFullText: ctx.surrealFullText,
  });
  const span: EvidenceSpan = {
    quote: evidence.quote,
    start: evidence.start,
    end: evidence.end,
    source_hash: evidence.sourceHash,
    match: (evidence.match as EvidenceSpan["match"]) ?? "exact",
  };
  const outcome = await recheckEvidenceSpanAgainstText({
    span,
    sourceText: resolved.text || null,
    quality: resolved.quality,
  });
  return { ok: true, outcome };
}

// ── Operator actions (POST action: accept | exclude) ────────────────────────

export type VerificationActionResult =
  | { ok: true; verificationState: "supported" | "excluded"; validationStatus?: string }
  | { ok: false; status: number; message: string };

/**
 * Accept a claim into `supported`. Guarded by ledger row 2: refuses unless the
 * current evidence span is Layer-1 bound — the UI shows the refusal verbatim.
 */
export async function acceptConnectUnitAsSupported(params: {
  workspaceId: string;
  unitId: string;
  domainPackId?: string | null;
  /** Attribution recorded as judged_by (e.g. "operator:<user id>"). */
  actor: string;
}): Promise<VerificationActionResult> {
  const ctx = await loadDossierContext(
    params.workspaceId,
    params.unitId,
    params.domainPackId ?? null,
  );
  if (!ctx) return { ok: false, status: 404, message: "Claim not found in your graph store." };

  const guard = canAcceptAsSupported(ctx.summary);
  if (!guard.ok) return { ok: false, status: 409, message: guard.reason };

  if (ctx.store === "surreal" && ctx.graphStore) {
    try {
      await ctx.graphStore.query(
        `UPDATE ${surrealRecordRef(ctx.unitId)} MERGE { verification_state: "supported" };`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
    return { ok: true, verificationState: "supported" };
  }

  const updated = await updateConnectClaimVersionStatesPostgres({
    workspaceId: params.workspaceId,
    states: [{ unitId: params.unitId, state: "supported", judgedBy: params.actor }],
  });
  if (updated === 0) {
    return { ok: false, status: 404, message: "No current claim version to update." };
  }
  return { ok: true, verificationState: "supported" };
}

/**
 * Reversible soft-exclude (never hard-delete): marks the claim's verification
 * state `excluded` and its legacy validation status `removed` so retrieval and
 * the queue skip it — every row and version stays on the record.
 */
export async function excludeConnectUnit(params: {
  workspaceId: string;
  unitId: string;
  domainPackId?: string | null;
  actor: string;
  note?: string | null;
}): Promise<VerificationActionResult> {
  const ctx = await loadDossierContext(
    params.workspaceId,
    params.unitId,
    params.domainPackId ?? null,
  );
  if (!ctx) return { ok: false, status: 404, message: "Claim not found in your graph store." };

  const note =
    params.note?.trim() ||
    `Operator exclude (${params.actor}): soft-excluded from retrieval — reversible.`;

  if (ctx.store === "surreal" && ctx.graphStore) {
    try {
      await ctx.graphStore.query(
        `UPDATE ${surrealRecordRef(ctx.unitId)} MERGE { verification_state: "excluded", validation_status: ${JSON.stringify(REMOVED_VALIDATION_STATUS)}, validation_note: ${JSON.stringify(note)} };`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
    return {
      ok: true,
      verificationState: "excluded",
      validationStatus: REMOVED_VALIDATION_STATUS,
    };
  }

  // EBV state (claim version) + legacy validation (unit row) — both soft, both reversible.
  await updateConnectClaimVersionStatesPostgres({
    workspaceId: params.workspaceId,
    states: [{ unitId: params.unitId, state: "excluded", judgedBy: params.actor }],
  });
  await updateUnitValidationPostgres({
    workspaceId: params.workspaceId,
    results: [{ unitId: params.unitId, status: REMOVED_VALIDATION_STATUS, note }],
  });
  return {
    ok: true,
    verificationState: "excluded",
    validationStatus: REMOVED_VALIDATION_STATUS,
  };
}

// ── Units-API enrichment (Postgres spine) ────────────────────────────────────

/**
 * Per-unit EBV summaries for a page of Postgres-spine units, keyed by unit id.
 * Units without claim-version rows are absent (the UI reads that as
 * "predates evidence binding"). Best-effort: an unreadable EBV store returns an
 * empty map rather than failing the units API.
 */
export async function loadConnectUnitEvidenceSummaries(params: {
  workspaceId: string;
  unitIds: string[];
}): Promise<Map<string, UnitEvidenceSummary>> {
  const map = new Map<string, UnitEvidenceSummary>();
  if (params.unitIds.length === 0) return map;
  try {
    const rows = await listConnectClaimEvidenceForUnitsPostgres({
      workspaceId: params.workspaceId,
      unitIds: params.unitIds,
    });
    for (const row of rows) {
      map.set(row.unitId, composeEvidenceSummaryFromPostgresRow(row));
    }
  } catch (err) {
    console.warn(
      "[evidence-dossier] units enrichment skipped:",
      err instanceof Error ? err.message : err,
    );
  }
  return map;
}
