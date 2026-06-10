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
  insertConnectClaimVersionsPostgres,
  insertConnectGraphSourcePostgres,
  storeExtractedGraphPostgres,
  storeGroupsPostgres,
  updateConnectClaimVersionStatesPostgres,
  updateUnitEmbeddingsPostgres,
  updateUnitTextPostgres,
  updateUnitValidationPostgres,
} from "$lib/server/neon";
import type { EvidenceBinding, ClaimVerificationState } from "@restormel/connect-core";
import { requireGraphUnitSourceId } from "$lib/server/connect/graph-ingest-source";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";

export interface StoredUnit {
  id: string;
  localId: string;
  text: string;
  type: string | null;
}

export interface GraphWriter {
  readonly provider: "postgres" | "surreal";
  writeSource(s: { title: string; url: string | null; textPreview: string | null; sourceKind: string }): Promise<string>;
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
   * hash + match kind). Returns persisted/missed so callers surface capability gaps
   * (e.g. SCHEMAFULL Surreal tables rejecting the fields) instead of failing silently.
   */
  setEvidence(args: {
    sourceHash: string;
    bindings: { unitId: string; text: string; binding: EvidenceBinding }[];
  }): Promise<{ persisted: number; missed: number }>;
  /** EBV: persist per-unit verification state (supported|inferred|unverified|…). */
  setVerificationStates(
    states: { unitId: string; state: ClaimVerificationState; judgedBy?: string | null }[],
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

  writeSource(s: { title: string; url: string | null; textPreview: string | null; sourceKind: string }) {
    return insertConnectGraphSourcePostgres({
      workspaceId: this.workspaceId,
      domainPackId: this.domainPackId,
      jobId: this.jobId,
      title: s.title,
      url: s.url,
      textPreview: s.textPreview,
      sourceKind: s.sourceKind,
    });
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

  async setEvidence(args: {
    sourceHash: string;
    bindings: { unitId: string; text: string; binding: EvidenceBinding }[];
  }) {
    const persisted = await insertConnectClaimVersionsPostgres({
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
      })),
    });
    return { persisted, missed: args.bindings.length - persisted };
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

  async writeSource(s: { title: string; url: string | null; textPreview: string | null; sourceKind: string }) {
    const table = ident(this.schema.source_table, "source");
    const id = await this.createReturningId(table, {
      title: s.title,
      url: s.url,
      text_preview: s.textPreview,
      source_kind: s.sourceKind,
      ingested_at: new Date().toISOString(),
    });
    if (!id) {
      throw new Error(
        `Could not persist ingest source record in Surreal graph store (table: ${table}). ` +
          "If this came from a graph-imported pipeline catalog entry, re-import sources in the readiness wizard so provenance links back to your existing Surreal records.",
      );
    }
    return id;
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
    for (const u of args.units) {
      if (!u.text.trim()) continue;
      const id = await this.createReturningId(unitTable, {
        text: u.text,
        unit_type: u.unitType,
        domain: u.domain,
        source: sourceId,
        ...(u.sourceChunkIndex != null ? { source_chunk_index: u.sourceChunkIndex } : {}),
      });
      if (!id) continue;
      idByLocal.set(u.localId, id);
      stored.push({ id, localId: u.localId, text: u.text, type: u.unitType });
    }
    let relations = 0;
    let relationFailures = 0;
    for (const r of args.relations) {
      const from = idByLocal.get(r.fromLocalId);
      const to = idByLocal.get(r.toLocalId);
      if (!from || !to) {
        relationFailures += 1;
        continue;
      }
      const edge = ident(r.relationType, "relates_to");
      try {
        await this.store.query(
          `RELATE ${surrealRecordRef(from)}->${edge}->${surrealRecordRef(to)};`,
        );
        relations += 1;
      } catch {
        relationFailures += 1;
      }
    }
    if (relationFailures > 0) {
      console.warn(
        `[connect-graph-writer] ${relationFailures} relation(s) failed to persist (${relations} ok)`,
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

  async setEvidence(args: {
    sourceHash: string;
    bindings: { unitId: string; text: string; binding: EvidenceBinding }[];
  }) {
    if (args.bindings.length === 0) return { persisted: 0, missed: 0 };
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
          `DEFINE FIELD IF NOT EXISTS evidence_source_hash ON TABLE ${unitTable} TYPE option<string>;`,
      )
      .catch(() => {
        // Older SurrealDB without IF NOT EXISTS, or SCHEMALESS — writes work regardless.
      });
    let persisted = 0;
    let missed = 0;
    let firstMiss: { unitId: string; got: unknown } | null = null;
    for (const b of args.bindings) {
      const bound = b.binding.status === "bound" ? b.binding.span : null;
      const payload = {
        evidence_quote: bound?.quote ?? null,
        evidence_start: bound?.start ?? null,
        evidence_end: bound?.end ?? null,
        evidence_match: bound?.match ?? null,
        evidence_status: b.binding.status,
        evidence_source_hash: args.sourceHash,
      };
      try {
        const res = await this.store.query<Array<Record<string, unknown>>>(
          `UPDATE ${surrealRecordRef(b.unitId)} MERGE ${JSON.stringify(payload)} RETURN AFTER;`,
        );
        const rec = Array.isArray(res) ? res[0] : undefined;
        if (rec && rec.evidence_status === b.binding.status) {
          persisted += 1;
        } else {
          missed += 1;
          if (!firstMiss) firstMiss = { unitId: b.unitId, got: rec?.evidence_status ?? null };
        }
      } catch (err) {
        missed += 1;
        if (!firstMiss) firstMiss = { unitId: b.unitId, got: `error: ${err instanceof Error ? err.message : err}` };
      }
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${args.bindings.length} evidence write(s) did NOT persist on table "${unitTable}" ` +
          `(sample id=${firstMiss?.unitId}, read-back=${JSON.stringify(firstMiss?.got)}) — ` +
          `SCHEMAFULL tables need the evidence_* fields defined; see the EBV docs.`,
      );
    }
    return { persisted, missed };
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
    let persisted = 0;
    let missed = 0;
    let firstMiss: { unitId: string; got: unknown } | null = null;
    for (const s of states) {
      try {
        const res = await this.store.query<Array<Record<string, unknown>>>(
          `UPDATE ${surrealRecordRef(s.unitId)} MERGE { verification_state: ${JSON.stringify(s.state)} } RETURN AFTER;`,
        );
        const rec = Array.isArray(res) ? res[0] : undefined;
        if (rec && rec.verification_state === s.state) {
          persisted += 1;
        } else {
          missed += 1;
          if (!firstMiss) firstMiss = { unitId: s.unitId, got: rec?.verification_state ?? null };
        }
      } catch (err) {
        missed += 1;
        if (!firstMiss) firstMiss = { unitId: s.unitId, got: `error: ${err instanceof Error ? err.message : err}` };
      }
    }
    if (missed > 0) {
      console.warn(
        `[connect-graph-writer] ${missed}/${states.length} verification-state write(s) did NOT persist on table "${unitTable}" ` +
          `(sample id=${firstMiss?.unitId}, read-back=${JSON.stringify(firstMiss?.got)}).`,
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
