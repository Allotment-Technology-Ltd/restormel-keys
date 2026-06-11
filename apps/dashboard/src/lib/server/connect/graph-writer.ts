/**
 * GraphWriter abstraction: a storage-agnostic surface the ingestion orchestrator
 * writes to, so the full pipeline (extract → relate → group → embed → validate →
 * remediate) runs identically against the Postgres spine or a Bring-Your-Own
 * SurrealDB. Postgres uses the typed spine tables; Surreal uses CREATE/RELATE/UPDATE
 * over HTTP /sql with table/edge names from the domain pack's graph schema.
 */
import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ConnectGraphTargetRecord } from "$lib/server/neon";
import {
  deleteUnitPostgres,
  findLatestConnectGraphSourceByKeyPostgres,
  insertConnectClaimJudgmentsPostgres,
  insertConnectClaimVersionsPostgres,
  insertConnectGraphSourcePostgres,
  listCurrentConnectClaimVersionsForSourceKeyPostgres,
  storeExtractedGraphPostgres,
  storeGroupsPostgres,
  supersedeConnectClaimVersionsPostgres,
  touchConnectGraphSourceSeenPostgres,
  updateConnectClaimVersionStatesPostgres,
  updateUnitEmbeddingsPostgres,
  updateUnitTextPostgres,
  updateUnitValidationPostgres,
} from "$lib/server/neon";
import type {
  EvidenceBinding,
  ClaimVerificationState,
  PriorClaimVersion,
} from "@restormel/connect-core";
import { requireGraphUnitSourceId } from "$lib/server/connect/graph-ingest-source";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";

export interface StoredUnit {
  id: string;
  localId: string;
  text: string;
  type: string | null;
}

/**
 * One claim-version evidence row (EBV Layer 1), optionally annotated with Stage 3.2
 * identity + carry-forward metadata when the source is a re-ingest.
 */
export type ClaimVersionBinding = {
  unitId: string;
  text: string;
  binding: EvidenceBinding;
  /** Deterministic claim identity (Stage 3.2). Written on every ingest so re-ingests can match. */
  claimKey?: string | null;
  /** 1 for new claims; prior version + 1 when this version supersedes one. */
  versionNo?: number;
  /** Carry-forward: copied verification state for an unchanged claim — no re-judging. */
  carried?: {
    verificationState: string;
    judgedBy: string | null;
    judgedAt: string | null;
  } | null;
};

export interface GraphWriter {
  readonly provider: "postgres" | "surreal";
  writeSource(s: {
    title: string;
    url: string | null;
    textPreview: string | null;
    sourceKind: string;
    /** Stage 3.2: stable cross-run identity of the document (deriveClaimSourceKey). */
    sourceKey?: string | null;
    /** Stage 3.2: content hash of the source version being registered. */
    contentHash?: string | null;
  }): Promise<string>;
  /**
   * Stage 3.2: latest registered version of a source by stable source key, or null when
   * unknown — or when the store does not support incremental re-ingest yet (Surreal BYO:
   * the runner logs the degrade and runs a full ingest; never silent).
   */
  findSourceVersion(
    sourceKey: string,
  ): Promise<{ sourceId: string; contentHash: string | null } | null>;
  /** Stage 3.2: the only write an unchanged-source skip performs (last_seen_at touch). */
  touchSourceSeen(sourceId: string): Promise<void>;
  /**
   * Stage 3.2: current (valid_to IS NULL) claim versions across ALL prior source rows
   * with this stable source key — so claims from an older generation are always part of
   * the re-ingest diff, never silently kept.
   */
  listCurrentClaimVersions(sourceKey: string): Promise<PriorClaimVersion[]>;
  /**
   * Stage 3.2: close validity windows; superseded_by links forward when a successor
   * exists (null for removed claims). Reversible — never deletes version rows.
   */
  supersedeClaimVersions(
    rows: { versionId: string; supersededBy: string | null }[],
  ): Promise<{ persisted: number; missed: number }>;
  writeUnitsAndRelations(args: {
    sourceId: string;
    units: {
      localId: string;
      text: string;
      unitType: string | null;
      domain: string | null;
      sourceChunkIndex?: number;
    }[];
    relations: { fromLocalId: string; toLocalId: string; relationType: string }[];
  }): Promise<{ units: StoredUnit[]; relations: number }>;
  storeGroups(groups: { name: string; summary: string | null; members: { unitId: string; role: string | null }[] }[]): Promise<{ groups: number }>;
  setEmbeddings(pairs: { unitId: string; vector: number[] }[]): Promise<number>;
  setValidation(results: { unitId: string; status: string; note: string | null }[]): Promise<number>;
  /**
   * EBV Layer 1: persist per-unit evidence bindings (quote + offsets + source-version
   * hash + match kind), plus Stage 3.2 claim identity/version metadata when supplied.
   * Returns persisted/missed so callers surface capability gaps (e.g. SCHEMAFULL Surreal
   * tables rejecting the fields) instead of failing silently, and the new version row
   * ids per unit (when the store tracks them) so supersession can chain forward.
   */
  setEvidence(args: {
    sourceHash: string;
    bindings: ClaimVersionBinding[];
  }): Promise<{ persisted: number; missed: number; versionIdByUnitId: Map<string, string> }>;
  /** EBV: persist per-unit verification state (supported|inferred|unverified|…). */
  setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
  ): Promise<{ persisted: number; missed: number }>;
  /**
   * EBV Layer 2: append entailment judgments (audit history — every verdict retained
   * with judge model + prompt version + timestamp; re-judging never overwrites).
   */
  recordJudgments(
    rows: {
      unitId: string;
      verdict: string;
      confidence: number | null;
      note: string | null;
      judgeModel: string | null;
      promptVersion: number;
      judgedAt: string;
    }[],
  ): Promise<{ persisted: number; missed: number }>;
  updateUnitText(unitId: string, text: string): Promise<void>;
  deleteUnit(unitId: string): Promise<void>;
  /** Soft-exclude: mark removed (hidden from retrieval/queue) but keep the record. Reversible. */
  excludeUnit(unitId: string, note: string): Promise<void>;
}

/** Sentinel validation_status for soft-excluded ideas — kept in the store, out of active use. */
export const REMOVED_VALIDATION_STATUS = "removed" as const;

// ── Postgres ──────────────────────────────────────────────────────────────────

class PostgresGraphWriter implements GraphWriter {
  readonly provider = "postgres" as const;
  constructor(
    private readonly workspaceId: string,
    private readonly domainPackId: string | null,
    private readonly jobId: string,
  ) {}

  writeSource(s: {
    title: string;
    url: string | null;
    textPreview: string | null;
    sourceKind: string;
    sourceKey?: string | null;
    contentHash?: string | null;
  }) {
    return insertConnectGraphSourcePostgres({
      workspaceId: this.workspaceId,
      domainPackId: this.domainPackId,
      jobId: this.jobId,
      title: s.title,
      url: s.url,
      textPreview: s.textPreview,
      sourceKind: s.sourceKind,
      sourceKey: s.sourceKey ?? null,
      contentHash: s.contentHash ?? null,
    });
  }

  findSourceVersion(sourceKey: string) {
    return findLatestConnectGraphSourceByKeyPostgres({
      workspaceId: this.workspaceId,
      sourceKey,
    }).then((row) => (row ? { sourceId: row.id, contentHash: row.contentHash } : null));
  }

  touchSourceSeen(sourceId: string) {
    return touchConnectGraphSourceSeenPostgres({ workspaceId: this.workspaceId, id: sourceId });
  }

  listCurrentClaimVersions(sourceKey: string): Promise<PriorClaimVersion[]> {
    return listCurrentConnectClaimVersionsForSourceKeyPostgres({
      workspaceId: this.workspaceId,
      sourceKey,
    });
  }

  async supersedeClaimVersions(rows: { versionId: string; supersededBy: string | null }[]) {
    const persisted = await supersedeConnectClaimVersionsPostgres({
      workspaceId: this.workspaceId,
      rows,
    });
    return { persisted, missed: rows.length - persisted };
  }

  async writeUnitsAndRelations(args: {
    sourceId: string;
    units: {
      localId: string;
      text: string;
      unitType: string | null;
      domain: string | null;
      sourceChunkIndex?: number;
    }[];
    relations: { fromLocalId: string; toLocalId: string; relationType: string }[];
  }): Promise<{ units: StoredUnit[]; relations: number }> {
    const sourceId = requireGraphUnitSourceId(args.sourceId);
    const stored = await storeExtractedGraphPostgres({
      workspaceId: this.workspaceId,
      domainPackId: this.domainPackId,
      sourceId,
      units: args.units,
      relations: args.relations,
    });
    // storeExtractedGraphPostgres returns units in insertion order matching input order.
    const units: StoredUnit[] = stored.units.map((u, i) => ({
      id: u.id,
      localId: args.units[i]?.localId ?? u.id,
      text: u.text,
      type: u.type,
    }));
    return { units, relations: stored.relations };
  }

  async storeGroups(groups: { name: string; summary: string | null; members: { unitId: string; role: string | null }[] }[]) {
    const res = await storeGroupsPostgres({ workspaceId: this.workspaceId, domainPackId: this.domainPackId, groups });
    return { groups: res.groups };
  }

  setEmbeddings(pairs: { unitId: string; vector: number[] }[]) {
    return updateUnitEmbeddingsPostgres({ workspaceId: this.workspaceId, embeddings: pairs });
  }

  setValidation(results: { unitId: string; status: string; note: string | null }[]) {
    return updateUnitValidationPostgres({ workspaceId: this.workspaceId, results });
  }

  async setEvidence(args: { sourceHash: string; bindings: ClaimVersionBinding[] }) {
    const inserted = await insertConnectClaimVersionsPostgres({
      workspaceId: this.workspaceId,
      rows: args.bindings.map((b) => ({
        unitId: b.unitId,
        text: b.text,
        evidenceQuote: b.binding.status === "bound" ? b.binding.span.quote : null,
        spanStart: b.binding.status === "bound" ? b.binding.span.start : null,
        spanEnd: b.binding.status === "bound" ? b.binding.span.end : null,
        evidenceMatch: b.binding.status === "bound" ? b.binding.span.match : null,
        evidenceStatus: b.binding.status,
        sourceHash: args.sourceHash,
        claimKey: b.claimKey ?? null,
        versionNo: b.versionNo ?? 1,
        // Carry-forward (Stage 3.2): copied verification state, no re-judging.
        verificationState: b.carried?.verificationState ?? null,
        judgedBy: b.carried?.judgedBy ?? null,
        judgedAt: b.carried?.judgedAt ?? null,
      })),
    });
    const versionIdByUnitId = new Map(inserted.map((r) => [r.unitId, r.versionId]));
    return {
      persisted: inserted.length,
      missed: args.bindings.length - inserted.length,
      versionIdByUnitId,
    };
  }

  async setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
  ) {
    const persisted = await updateConnectClaimVersionStatesPostgres({
      workspaceId: this.workspaceId,
      states,
    });
    return { persisted, missed: states.length - persisted };
  }

  async recordJudgments(
    rows: {
      unitId: string;
      verdict: string;
      confidence: number | null;
      note: string | null;
      judgeModel: string | null;
      promptVersion: number;
      judgedAt: string;
    }[],
  ) {
    const persisted = await insertConnectClaimJudgmentsPostgres({
      workspaceId: this.workspaceId,
      rows,
    });
    return { persisted, missed: rows.length - persisted };
  }

  updateUnitText(unitId: string, text: string) {
    return updateUnitTextPostgres({ workspaceId: this.workspaceId, unitId, text });
  }

  deleteUnit(unitId: string) {
    return deleteUnitPostgres({ workspaceId: this.workspaceId, unitId });
  }

  async excludeUnit(unitId: string, note: string) {
    await updateUnitValidationPostgres({
      workspaceId: this.workspaceId,
      results: [{ unitId, status: REMOVED_VALIDATION_STATUS, note }],
    });
  }
}

// ── Surreal (BYO) ───────────────────────────────────────────────────────────────

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function ident(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

/** Walk nested Surreal HTTP result shapes from CREATE … RETURN id. */
export function extractCreatedRecordId(res: unknown): string | null {
  const queue: unknown[] = [res];
  while (queue.length > 0) {
    const item = queue.shift();
    if (Array.isArray(item)) {
      for (const child of item) queue.push(child);
      continue;
    }
    const direct = formatSurrealRecordId(item);
    if (direct) return direct;
    if (item && typeof item === "object") {
      const nested = formatSurrealRecordId((item as Record<string, unknown>).id);
      if (nested) return nested;
    }
  }
  return null;
}

/** Parse Surreal record ids returned by CREATE … RETURN id (string or RecordId object). */
export function formatSurrealRecordId(value: unknown): string | null {
  if (typeof value === "string" && value.includes(":")) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if (typeof rec.tb === "string" && rec.id != null) {
      return `${rec.tb}:${String(rec.id)}`;
    }
    if (typeof rec.id === "string" && rec.id.includes(":")) return rec.id;
  }
  return null;
}

/** Quote record ids for SurrealQL when they contain characters that need escaping. */
export function surrealRecordRef(id: string): string {
  if (/^[`'[\]]/.test(id) || /[^\w:-]/.test(id)) {
    return `\`${id.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``;
  }
  return id;
}

class SurrealGraphWriter implements GraphWriter {
  readonly provider = "surreal" as const;
  private readonly schema: ConnectDomainPack["graph_schema"];
  constructor(
    private readonly store: GraphStore,
    pack: ConnectDomainPack,
  ) {
    this.schema = pack.graph_schema;
  }

  private async createReturningId(table: string, content: Record<string, unknown>): Promise<string | null> {
    const res = await this.store.query<unknown>(`CREATE ${table} CONTENT ${JSON.stringify(content)} RETURN id;`);
    return extractCreatedRecordId(res);
  }

  async writeSource(s: {
    title: string;
    url: string | null;
    textPreview: string | null;
    sourceKind: string;
    sourceKey?: string | null;
    contentHash?: string | null;
  }) {
    const table = ident(this.schema.source_table, "source");
    const id = await this.createReturningId(table, {
      title: s.title,
      url: s.url,
      text_preview: s.textPreview,
      source_kind: s.sourceKind,
      ingested_at: new Date().toISOString(),
      // Stage 3.2 identity fields — written opportunistically (SCHEMAFULL tables drop
      // them) so the data is in place when Surreal incremental re-ingest lands.
      ...(s.sourceKey ? { source_key: s.sourceKey } : {}),
      ...(s.contentHash ? { content_hash: s.contentHash } : {}),
      ...(s.contentHash ? { last_seen_at: new Date().toISOString() } : {}),
    });
    if (!id) {
      throw new Error(
        `Could not persist ingest source record in Surreal graph store (table: ${table}). ` +
          "If this came from a graph-imported pipeline catalog entry, re-import sources in the readiness wizard so provenance links back to your existing Surreal records.",
      );
    }
    return id;
  }

  /**
   * Stage 3.2 — NOT YET on Surreal BYO stores: the ADR places version chains in a
   * Restormel-created `restormel_claim_versions` table in the user's database, but that
   * placement is the ADR's open question 1 (split-brain risk) and is awaiting explicit
   * sign-off. Until then a Surreal re-ingest degrades to today's full ingest; the runner
   * logs the degrade per source — never silent.
   */
  async findSourceVersion(): Promise<{ sourceId: string; contentHash: string | null } | null> {
    return null;
  }

  async touchSourceSeen(sourceId: string) {
    await this.store
      .query(
        `UPDATE ${surrealRecordRef(sourceId)} MERGE { last_seen_at: ${JSON.stringify(new Date().toISOString())} };`,
      )
      .catch(() => {});
  }

  async listCurrentClaimVersions(): Promise<PriorClaimVersion[]> {
    return [];
  }

  async supersedeClaimVersions(rows: { versionId: string; supersededBy: string | null }[]) {
    // Unreachable while findSourceVersion returns null; defensively report as missed.
    return { persisted: 0, missed: rows.length };
  }

  async writeUnitsAndRelations(args: {
    sourceId: string;
    units: {
      localId: string;
      text: string;
      unitType: string | null;
      domain: string | null;
      sourceChunkIndex?: number;
    }[];
    relations: { fromLocalId: string; toLocalId: string; relationType: string }[];
  }): Promise<{ units: StoredUnit[]; relations: number }> {
    const sourceId = requireGraphUnitSourceId(args.sourceId);
    const unitTable = ident(this.schema.unit_table, "unit");
    const stored: StoredUnit[] = [];
    const idByLocal = new Map<string, string>();

    // Batched multi-statement script: one CREATE per unit in a single HTTP /sql round-trip,
    // each statement RETURNing id.  Positional matching of results to input units preserves
    // the caller's local-id → stored-id mapping without per-unit await chains.
    const validUnits = args.units.filter((u) => u.text.trim());
    if (validUnits.length > 0) {
      const statements = validUnits.map((u) => {
        const content: Record<string, unknown> = {
          text: u.text,
          unit_type: u.unitType,
          domain: u.domain,
          source: sourceId,
          ...(u.sourceChunkIndex != null ? { source_chunk_index: u.sourceChunkIndex } : {}),
        };
        return `CREATE ${unitTable} CONTENT ${JSON.stringify(content)} RETURN id;`;
      });
      try {
        const scriptResult = await this.store.query<unknown>(statements.join("\n"));
        // Surreal returns one result entry per statement; each entry is an array of created records.
        const perStatement: unknown[] = Array.isArray(scriptResult) ? (scriptResult as unknown[]) : [];
        for (let i = 0; i < validUnits.length; i++) {
          const u = validUnits[i]!;
          const id = extractCreatedRecordId(perStatement[i]);
          if (!id) continue;
          idByLocal.set(u.localId, id);
          stored.push({ id, localId: u.localId, text: u.text, type: u.unitType });
        }
      } catch (err) {
        console.warn(
          `[connect-graph-writer] unit batch CREATE failed — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Relations: collect resolvable pairs, then batch RELATE statements in one round-trip.
    const relPairs = args.relations.flatMap((r) => {
      const from = idByLocal.get(r.fromLocalId);
      const to = idByLocal.get(r.toLocalId);
      return from && to ? [{ from, to, edge: ident(r.relationType, "relates_to") }] : [];
    });
    const relationFailures = args.relations.length - relPairs.length;
    let relations = 0;
    if (relPairs.length > 0) {
      const relStatements = relPairs.map(
        (p) => `RELATE ${surrealRecordRef(p.from)}->${p.edge}->${surrealRecordRef(p.to)};`,
      );
      try {
        await this.store.query(relStatements.join("\n"));
        relations = relPairs.length;
      } catch (err) {
        console.warn(
          `[connect-graph-writer] relation batch RELATE failed — ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    if (relationFailures > 0) {
      console.warn(
        `[connect-graph-writer] ${relationFailures} relation(s) could not be resolved (unknown local ids)`,
      );
    }
    return { units: stored, relations };
  }

  async storeGroups(groups: { name: string; summary: string | null; members: { unitId: string; role: string | null }[] }[]) {
    const groupTable = ident(this.schema.group_table, "group");
    const partOf = ident(this.schema.part_of_edge, "part_of");
    let count = 0;
    for (const g of groups) {
      if (!g.name.trim() || g.members.length === 0) continue;
      const groupId = await this.createReturningId(groupTable, { name: g.name, summary: g.summary });
      if (!groupId) continue;
      count += 1;
      for (const m of g.members) {
        try {
          await this.store.query(
            `RELATE ${surrealRecordRef(m.unitId)}->${partOf}->${surrealRecordRef(groupId)}${m.role ? ` SET role = ${JSON.stringify(m.role)}` : ""};`,
          );
        } catch {
          // skip
        }
      }
    }
    return { groups: count };
  }

  async setEmbeddings(pairs: { unitId: string; vector: number[] }[]) {
    let n = 0;
    let failures = 0;
    const vectorField = ident(this.schema.unit_vector_field ?? "embedding", "embedding");
    for (const p of pairs) {
      try {
        await this.store.query(`UPDATE ${surrealRecordRef(p.unitId)} MERGE { ${vectorField}: ${JSON.stringify(p.vector)} };`);
        n += 1;
      } catch {
        failures += 1;
      }
    }
    if (failures > 0) {
      console.warn(
        `[connect-graph-writer] ${failures} embedding(s) failed to persist (${n} ok)`,
      );
    }
    return n;
  }

  async setValidation(results: { unitId: string; status: string; note: string | null }[]) {
    if (results.length === 0) return 0;
    const unitTable = ident(this.schema.unit_table, "unit");
    // A pre-existing SCHEMAFULL graph silently DROPS writes to undefined fields —
    // the UPDATE returns the record (no error) but the new field never sticks, so
    // reads keep showing "unchecked". Ensure the verdict fields exist first.
    await this.store
      .query(
        `DEFINE FIELD IF NOT EXISTS validation_status ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS validation_note ON TABLE ${unitTable} TYPE option<string>;`,
      )
      .catch(() => {
        // Older SurrealDB without IF NOT EXISTS, or SCHEMALESS — writes work regardless.
      });

    let persisted = 0;
    let missed = 0;
    let firstMiss: { unitId: string; got: unknown } | null = null;
    for (const r of results) {
      try {
        // RETURN AFTER so we can verify the field actually landed (not silently dropped).
        const res = await this.store.query<Array<Record<string, unknown>>>(
          `UPDATE ${surrealRecordRef(r.unitId)} MERGE { validation_status: ${JSON.stringify(r.status)}, validation_note: ${JSON.stringify(r.note)} } RETURN AFTER;`,
        );
        const rec = Array.isArray(res) ? res[0] : undefined;
        if (rec && rec.validation_status === r.status) {
          persisted += 1;
        } else {
          missed += 1;
          if (!firstMiss) firstMiss = { unitId: r.unitId, got: rec?.validation_status ?? null };
        }
      } catch (err) {
        missed += 1;
        if (!firstMiss) firstMiss = { unitId: r.unitId, got: `error: ${err instanceof Error ? err.message : err}` };
      }
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${results.length} validation write(s) did NOT persist on table "${unitTable}" ` +
          `(sample id=${firstMiss?.unitId}, read-back=${JSON.stringify(firstMiss?.got)})`,
      );
    }
    return persisted;
  }

  async setEvidence(args: { sourceHash: string; bindings: ClaimVersionBinding[] }) {
    // Version-row ids are not tracked on Surreal yet (see findSourceVersion note).
    const versionIdByUnitId = new Map<string, string>();
    if (args.bindings.length === 0) return { persisted: 0, missed: 0, versionIdByUnitId };
    const unitTable = ident(this.schema.unit_table, "unit");
    // Same SCHEMAFULL guard as setValidation: ensure the fields exist, then verify each
    // write actually landed — degraded persistence must be visible, never silent.
    await this.store
      .query(
        `DEFINE FIELD IF NOT EXISTS evidence_quote ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS evidence_start ON TABLE ${unitTable} TYPE option<number>; ` +
          `DEFINE FIELD IF NOT EXISTS evidence_end ON TABLE ${unitTable} TYPE option<number>; ` +
          `DEFINE FIELD IF NOT EXISTS evidence_match ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS evidence_status ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS evidence_source_hash ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS claim_key ON TABLE ${unitTable} TYPE option<string>;`,
      )
      .catch(() => {
        // Older SurrealDB without IF NOT EXISTS, or SCHEMALESS — writes work regardless.
      });

    // Batched multi-statement script: one UPDATE per unit in a single HTTP /sql round-trip,
    // each statement RETURNing the record's evidence_status so we can verify per-record that
    // the write landed.  Degraded-persistence is still visible — the SCHEMAFULL warning with
    // sample unitId/read-back stays intact; we just parse the N results from one round-trip.
    const statements = args.bindings.map((b) => {
      const bound = b.binding.status === "bound" ? b.binding.span : null;
      const payload = {
        evidence_quote: bound?.quote ?? null,
        evidence_start: bound?.start ?? null,
        evidence_end: bound?.end ?? null,
        evidence_match: bound?.match ?? null,
        evidence_status: b.binding.status,
        evidence_source_hash: args.sourceHash,
        claim_key: b.claimKey ?? null,
      };
      return `UPDATE ${surrealRecordRef(b.unitId)} MERGE ${JSON.stringify(payload)} RETURN AFTER;`;
    });
    let persisted = 0;
    let missed = 0;
    let firstMiss: { unitId: string; got: unknown } | null = null;
    try {
      // A Surreal HTTP /sql endpoint executes a multi-statement script as one request and
      // returns one result entry per statement.  We flatten the nested array that the
      // GraphStore HTTP client produces and match results positionally to bindings.
      const scriptResult = await this.store.query<unknown>(statements.join("\n"));
      // Surreal returns [[row, …], [row, …], …] — one inner array per statement.
      const perStatement: Array<Array<Record<string, unknown>>> = Array.isArray(scriptResult)
        ? (scriptResult as unknown[]).map((r) =>
            Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [r as Record<string, unknown>],
          )
        : [];
      for (let i = 0; i < args.bindings.length; i++) {
        const b = args.bindings[i]!;
        const stmtRows = perStatement[i] ?? [];
        const rec = stmtRows[0];
        if (rec && rec.evidence_status === b.binding.status) {
          persisted += 1;
        } else {
          missed += 1;
          if (!firstMiss) firstMiss = { unitId: b.unitId, got: rec?.evidence_status ?? null };
        }
      }
    } catch (err) {
      // Whole script failed — count all as missed, preserve fail-safe warning below.
      missed = args.bindings.length;
      const msg = err instanceof Error ? err.message : String(err);
      if (!firstMiss) firstMiss = { unitId: args.bindings[0]!.unitId, got: `error: ${msg}` };
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${args.bindings.length} evidence write(s) did NOT persist on table "${unitTable}" ` +
          `(sample id=${firstMiss?.unitId}, read-back=${JSON.stringify(firstMiss?.got)}) — ` +
          `SCHEMAFULL tables need the evidence_* fields defined; see the EBV docs.`,
      );
    }
    return { persisted, missed, versionIdByUnitId };
  }

  async setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
  ) {
    if (states.length === 0) return { persisted: 0, missed: 0 };
    const unitTable = ident(this.schema.unit_table, "unit");
    await this.store
      .query(
        `DEFINE FIELD IF NOT EXISTS verification_state ON TABLE ${unitTable} TYPE option<string>;`,
      )
      .catch(() => {});

    // Batched multi-statement script: one UPDATE per unit in a single HTTP /sql round-trip,
    // each statement RETURNing the record's verification_state for per-record read-back check.
    const statements = states.map(
      (s) =>
        `UPDATE ${surrealRecordRef(s.unitId)} MERGE { verification_state: ${JSON.stringify(s.state)} } RETURN AFTER;`,
    );
    let persisted = 0;
    let missed = 0;
    let firstMiss: { unitId: string; got: unknown } | null = null;
    try {
      const scriptResult = await this.store.query<unknown>(statements.join("\n"));
      const perStatement: Array<Array<Record<string, unknown>>> = Array.isArray(scriptResult)
        ? (scriptResult as unknown[]).map((r) =>
            Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [r as Record<string, unknown>],
          )
        : [];
      for (let i = 0; i < states.length; i++) {
        const s = states[i]!;
        const stmtRows = perStatement[i] ?? [];
        const rec = stmtRows[0];
        if (rec && rec.verification_state === s.state) {
          persisted += 1;
        } else {
          missed += 1;
          if (!firstMiss) firstMiss = { unitId: s.unitId, got: rec?.verification_state ?? null };
        }
      }
    } catch (err) {
      missed = states.length;
      const msg = err instanceof Error ? err.message : String(err);
      if (!firstMiss) firstMiss = { unitId: states[0]!.unitId, got: `error: ${msg}` };
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${states.length} verification-state write(s) did NOT persist on table "${unitTable}" ` +
          `(sample id=${firstMiss?.unitId}, read-back=${JSON.stringify(firstMiss?.got)}).`,
      );
    }
    return { persisted, missed };
  }

  async recordJudgments(
    rows: {
      unitId: string;
      verdict: string;
      confidence: number | null;
      note: string | null;
      judgeModel: string | null;
      promptVersion: number;
      judgedAt: string;
    }[],
  ) {
    if (rows.length === 0) return { persisted: 0, missed: 0 };
    // Append-only audit table alongside the pack's unit table. CREATE (never UPDATE)
    // so re-judging retains every prior verdict.
    // Batched multi-statement script: one CREATE per judgment in a single HTTP /sql round-trip,
    // each statement RETURNing the record's verdict for per-record read-back verification.
    const statements = rows.map((r) => {
      const payload = {
        unit: r.unitId,
        verdict: r.verdict,
        confidence: r.confidence,
        note: r.note,
        judge_model: r.judgeModel,
        prompt_version: r.promptVersion,
        judged_at: r.judgedAt,
      };
      return `CREATE connect_claim_judgment CONTENT ${JSON.stringify(payload)} RETURN AFTER;`;
    });
    let persisted = 0;
    let missed = 0;
    let firstErr: string | null = null;
    try {
      const scriptResult = await this.store.query<unknown>(statements.join("\n"));
      const perStatement: Array<Array<Record<string, unknown>>> = Array.isArray(scriptResult)
        ? (scriptResult as unknown[]).map((r) =>
            Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [r as Record<string, unknown>],
          )
        : [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        const stmtRows = perStatement[i] ?? [];
        const rec = stmtRows[0];
        if (rec && rec.verdict === r.verdict) persisted += 1;
        else missed += 1;
      }
    } catch (err) {
      missed = rows.length;
      firstErr = err instanceof Error ? err.message : String(err);
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${rows.length} judgment write(s) did NOT persist ` +
          `on "connect_claim_judgment"${firstErr ? ` (first error: ${firstErr.slice(0, 120)})` : ""}.`,
      );
    }
    return { persisted, missed };
  }

  async updateUnitText(unitId: string, text: string) {
    await this.store.query(
      `UPDATE ${surrealRecordRef(unitId)} MERGE { text: ${JSON.stringify(text)}, validation_status: "ok", validation_note: "remediated" };`,
    );
  }

  async deleteUnit(unitId: string) {
    await this.store.query(`DELETE ${surrealRecordRef(unitId)};`);
  }

  async excludeUnit(unitId: string, note: string) {
    const unitTable = ident(this.schema.unit_table, "unit");
    await this.store
      .query(
        `DEFINE FIELD IF NOT EXISTS validation_status ON TABLE ${unitTable} TYPE option<string>; ` +
          `DEFINE FIELD IF NOT EXISTS validation_note ON TABLE ${unitTable} TYPE option<string>;`,
      )
      .catch(() => {});
    await this.store.query(
      `UPDATE ${surrealRecordRef(unitId)} MERGE { validation_status: ${JSON.stringify(REMOVED_VALIDATION_STATUS)}, validation_note: ${JSON.stringify(note)} };`,
    );
  }
}

/**
 * Test-only factory — exposes a SurrealGraphWriter backed by a custom GraphStore for unit
 * tests that need to assert batching and round-trip count without a real SurrealDB instance.
 * Named with a `test` prefix so tree-shaking / linting can flag production callers.
 */
export function makeSurrealGraphWriterForTest(
  store: GraphStore,
  pack: ConnectDomainPack,
): GraphWriter {
  return new SurrealGraphWriter(store, pack);
}

/** Build a writer for the workspace's configured target. Returns null if Surreal is unreachable. */
export async function buildGraphWriter(
  target: ConnectGraphTargetRecord,
  pack: ConnectDomainPack,
  job: { workspaceId: string; domainPackId: string | null; id: string },
): Promise<GraphWriter | null> {
  if (target.provider === "postgres") {
    return new PostgresGraphWriter(job.workspaceId, job.domainPackId, job.id);
  }
  if (target.provider === "surreal") {
    const store = await buildWorkspaceGraphStore(job.workspaceId);
    if (!store) return null;
    return new SurrealGraphWriter(store, pack);
  }
  return null;
}
