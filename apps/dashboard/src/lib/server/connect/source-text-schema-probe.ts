/**
 * Infer BYO Surreal source/passage text mapping when the active domain pack
 * does not resolve source text during a graph source scan.
 */
import type { ConnectDomainPack, ConnectGraphSchemaMap } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import {
  SOURCE_INLINE_TEXT_KEYS,
  PASSAGE_TEXT_KEYS,
  extractInlineSourceText,
  fetchPassageTextForSource,
} from "./surreal-source-text";
import {
  extractSourceTitle,
  extractSourceUrl,
  SOURCE_KIND_FIELD_KEYS,
  SOURCE_TITLE_FIELD_KEYS,
  SOURCE_URL_FIELD_KEYS,
} from "./source-field-extract";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Min trimmed length for an arbitrary string field to count as substantial inline text. */
const LONG_TEXT_MIN_CHARS = 200;

/** Identity / metadata field names that should never be treated as inline text. */
const NON_TEXT_IDENTITY_KEYS = new Set<string>([
  "id",
  "author",
  "authors",
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
  ...SOURCE_URL_FIELD_KEYS,
  ...SOURCE_KIND_FIELD_KEYS,
  ...SOURCE_TITLE_FIELD_KEYS,
]);

/** A table that might hold sources, surfaced to the operator when none were detected. */
export type CandidateTable = { name: string; count: number };

/** Tables that must never be treated as the bibliographic source catalog. */
const SKIP_SOURCE_TABLE_CANDIDATES = new Set([
  "passage",
  "review_audit_log",
  "query_cache",
  "link_ingestion_queue",
  "thinker_resolution_audit_log",
  "thinker_alias",
  "unresolved_thinker_reference",
]);

/** True when any SOURCE_INLINE_TEXT_KEYS field is a non-empty string. */
function hasInlineTextField(row: Record<string, unknown>): boolean {
  for (const field of SOURCE_INLINE_TEXT_KEYS) {
    const v = row[field];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}

/** True when any non-identity string field carries substantial text (≥ LONG_TEXT_MIN_CHARS). */
function hasSubstantialStringField(row: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(row)) {
    if (NON_TEXT_IDENTITY_KEYS.has(key)) continue;
    if (typeof value === "string" && value.trim().length >= LONG_TEXT_MIN_CHARS) return true;
  }
  return false;
}

/**
 * Recognise a source row by ANY identity-or-text signal — never by exact field
 * names. A row counts as bibliographic if it has a resolvable title/URL (across
 * synonyms) OR carries substantial inline text. This is what lets the owner's
 * `{ title, canonical_url, source_type, author[] }` shape be read as a source.
 */
export function isBibliographicSourceRow(row: Record<string, unknown>): boolean {
  if (extractSourceTitle(row) || extractSourceUrl(row)) return true;
  if (hasInlineTextField(row)) return true;
  return hasSubstantialStringField(row);
}

export function isInvalidSourceTableMapping(pack: ConnectDomainPack): boolean {
  const schema = pack.graph_schema;
  const source = schema.source_table.toLowerCase();
  const unit = schema.unit_table.toLowerCase();
  const group = schema.group_table.toLowerCase();
  const passage = schema.passage_table.toLowerCase();
  return source === unit || source === group || source === passage;
}

function excludedSourceTables(pack: ConnectDomainPack): Set<string> {
  const schema = pack.graph_schema;
  return new Set(
    [
      schema.unit_table,
      schema.group_table,
      schema.passage_table,
      ...SKIP_SOURCE_TABLE_CANDIDATES,
    ]
      .map((t) => t.toLowerCase())
      .filter(Boolean),
  );
}

export function isSourceTablePatchAllowed(
  pack: ConnectDomainPack,
  patch: SourceTextSchemaPatch,
): boolean {
  if (!patch.source_table) return true;
  const source = patch.source_table.toLowerCase();
  const unit = pack.graph_schema.unit_table.toLowerCase();
  const group = pack.graph_schema.group_table.toLowerCase();
  const passage = pack.graph_schema.passage_table.toLowerCase();
  return source !== unit && source !== group && source !== passage;
}

export type SourceTextSchemaPatch = Pick<
  ConnectGraphSchemaMap,
  | "source_table"
  | "passage_table"
  | "source_text_field"
  | "passage_text_field"
  | "passage_source_field"
>;

export type SourceTextPackSuggestion = {
  packId: string;
  packTitle: string;
  packSlug: string;
  canAutoApply: boolean;
  reason: string;
  current: SourceTextSchemaPatch;
  suggested: SourceTextSchemaPatch;
  confidence: "high" | "medium" | "low";
  changes: string[];
};

type TableMeta = { name: string; count: number };

function tableIdent(name: string): string | null {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : null;
}

export function sourceTextPatchFromPack(pack: ConnectDomainPack): SourceTextSchemaPatch {
  return packPatchFromSchema(pack.graph_schema);
}

function defaultPassageTextField(schema: ConnectGraphSchemaMap): string | undefined {
  if (!schema.passage_table?.trim()) return undefined;
  return schema.passage_text_field?.trim() || "text";
}

function packPatchFromSchema(schema: ConnectGraphSchemaMap): SourceTextSchemaPatch {
  const passageTextField = defaultPassageTextField(schema);
  return {
    source_table: schema.source_table,
    passage_table: schema.passage_table,
    ...(schema.source_text_field ? { source_text_field: schema.source_text_field } : {}),
    ...(passageTextField ? { passage_text_field: passageTextField } : {}),
    ...(schema.passage_source_field ? { passage_source_field: schema.passage_source_field } : {}),
  };
}

function mergePatch(base: SourceTextSchemaPatch, next: Partial<SourceTextSchemaPatch>): SourceTextSchemaPatch {
  return { ...base, ...next };
}

function patchPack(pack: ConnectDomainPack, patch: Partial<SourceTextSchemaPatch>): ConnectDomainPack {
  return {
    ...pack,
    graph_schema: { ...pack.graph_schema, ...patch },
  };
}

function listChanges(before: SourceTextSchemaPatch, after: SourceTextSchemaPatch): string[] {
  const changes: string[] = [];
  const keys = [
    "source_table",
    "passage_table",
    "source_text_field",
    "passage_text_field",
    "passage_source_field",
  ] as const;
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (b && a !== b) changes.push(`${key}: ${a ?? "(default)"} → ${b}`);
  }
  return changes;
}

function needsSchemaProbe(args: {
  pack: ConnectDomainPack;
  sourceRowCount: number;
  withText: number;
  total: number;
}): boolean {
  if (isInvalidSourceTableMapping(args.pack)) return true;
  if (args.sourceRowCount === 0) return true;
  if (args.total > 0 && args.withText === 0) return true;
  return false;
}

type InfoForDb = { tables?: Record<string, string> };

function parseInfoForDb(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const tables = (raw as InfoForDb).tables;
  if (!tables || typeof tables !== "object") return [];
  return Object.keys(tables)
    .map((n) => tableIdent(n))
    .filter((n): n is string => Boolean(n));
}

async function tableCount(store: GraphStore, table: string): Promise<number> {
  if (!SAFE_IDENT.test(table)) return 0;
  try {
    const rows = await store.query<{ count?: number }[]>(
      `SELECT count() AS count FROM ${table} GROUP ALL;`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function loadTableMeta(store: GraphStore, names: string[]): Promise<TableMeta[]> {
  const out: TableMeta[] = [];
  for (const name of names) {
    const count = await tableCount(store, name);
    if (count > 0) out.push({ name, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Field-name hints that suggest a table holds bibliographic sources. */
const SOURCE_NAME_HINTS = new Set([
  "source",
  "sources",
  "document",
  "documents",
  "doc",
  "docs",
  "paper",
  "papers",
  "article",
  "articles",
  "corpus",
  "reference",
  "references",
  "ref",
  "publication",
  "publications",
  "book",
  "books",
  "dataset",
  "datasets",
  "file",
  "files",
  "library",
]);

function rankSourceTables(
  current: string,
  exclude: Set<string>,
  tables: TableMeta[],
): string[] {
  const ordered = new Set<string>();
  const add = (name: string | undefined) => {
    if (!name || !SAFE_IDENT.test(name) || exclude.has(name)) return;
    ordered.add(name);
  };
  // Priority: exact "source", the current mapping, name-hinted tables, then
  // ALWAYS every remaining non-excluded table (ranked by count). The previous
  // implementation only fell back to all tables when nothing source-named existed,
  // so a sources table named e.g. "documents" was never even sampled when the
  // (empty) configured "source" table existed in the ranking.
  add("source");
  if (SAFE_IDENT.test(current)) add(current);
  for (const t of tables) {
    if (SOURCE_NAME_HINTS.has(t.name) || t.name.includes("source")) add(t.name);
  }
  for (const t of tables) add(t.name);
  return [...ordered];
}

function rankPassageTables(current: string, tables: TableMeta[]): string[] {
  const names = tables.map((t) => t.name);
  const ordered = new Set<string>();
  if (SAFE_IDENT.test(current)) ordered.add(current);
  if (names.includes("passage")) ordered.add("passage");
  for (const t of tables) {
    if (t.name.includes("passage")) ordered.add(t.name);
  }
  for (const t of tables) ordered.add(t.name);
  return [...ordered];
}

async function sampleSourceRow(
  store: GraphStore,
  sourceTable: string,
): Promise<Record<string, unknown> | null> {
  if (!SAFE_IDENT.test(sourceTable)) return null;
  // SELECT * so the FULL row is visible — a fixed field list is blind to
  // unconventional inline-text fields and to canonical_url / source_type.
  try {
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT * FROM ${sourceTable} LIMIT 1;`,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the inline-text field. Tries the conventional SOURCE_INLINE_TEXT_KEYS
 * first; failing that, accepts ANY non-identity string field carrying substantial
 * text (≥ LONG_TEXT_MIN_CHARS) — so full text under an unconventional field name
 * (e.g. `abstract`, `excerpt`) is still found.
 */
export function detectInlineField(row: Record<string, unknown>): string | undefined {
  for (const field of SOURCE_INLINE_TEXT_KEYS) {
    const v = row[field];
    if (typeof v === "string" && v.trim()) return field;
  }
  for (const [key, value] of Object.entries(row)) {
    if (NON_TEXT_IDENTITY_KEYS.has(key)) continue;
    if (typeof value === "string" && value.trim().length >= LONG_TEXT_MIN_CHARS) return key;
  }
  return undefined;
}

async function probeMapping(
  store: GraphStore,
  pack: ConnectDomainPack,
  sourceTable: string,
  passageTable: string,
  sampleRow: Record<string, unknown> | null,
): Promise<{
  patch: Partial<SourceTextSchemaPatch>;
  confidence: "high" | "medium" | "low";
  resolved: "inline" | "passage" | "none";
}> {
  const basePatch: Partial<SourceTextSchemaPatch> = {
    source_table: sourceTable,
    passage_table: passageTable,
  };

  const looksLikeSource = sampleRow ? isBibliographicSourceRow(sampleRow) : false;
  const sourceNamedTable = sourceTable === "source" || sourceTable.includes("source");
  const hasIdentity = sampleRow
    ? Boolean(extractSourceTitle(sampleRow) || extractSourceUrl(sampleRow))
    : false;

  // Inline detection is DECOUPLED from looksLikeSource — a row whose only signal is
  // a long text field still resolves inline. Confidence is high when the row also
  // looks like a source or the inline field is conventional; otherwise medium.
  if (sampleRow) {
    const inlineField = detectInlineField(sampleRow);
    if (inlineField) {
      const conventional = (SOURCE_INLINE_TEXT_KEYS as readonly string[]).includes(inlineField);
      return {
        patch: { ...basePatch, source_text_field: inlineField },
        confidence: looksLikeSource || conventional || hasIdentity ? "high" : "medium",
        resolved: "inline",
      };
    }
  }

  if (sampleRow) {
    const sourceId =
      typeof sampleRow.id === "string" ? sampleRow.id : String(sampleRow.id ?? "");
    if (sourceId.includes(":")) {
      for (const passageTextField of PASSAGE_TEXT_KEYS) {
        for (const passageSourceField of ["source", "source_id", "source_ref"] as const) {
          const trial = patchPack(pack, {
            ...basePatch,
            passage_text_field: passageTextField,
            passage_source_field: passageSourceField,
          });
          const passage = await fetchPassageTextForSource(store, trial, sourceId);
          if (passage?.text) {
            return {
              patch: {
                ...basePatch,
                passage_text_field: passageTextField,
                passage_source_field: passageSourceField,
              },
              confidence: "high",
              resolved: "passage",
            };
          }
        }
      }
      const passage = await fetchPassageTextForSource(store, patchPack(pack, basePatch), sourceId);
      if (passage?.text) {
        return { patch: basePatch, confidence: "high", resolved: "passage" };
      }
    }
  }

  // Recognised as a source by identity/text signal even though text didn't resolve
  // here (it may live in a passage table or resolve on a later pass). A source
  // RECORD existing is distinct from its text resolving — high when the table is
  // also source-named, medium otherwise. Low ONLY when no identity and no text.
  if (sampleRow && looksLikeSource) {
    return {
      patch: basePatch,
      confidence: sourceNamedTable && hasIdentity ? "high" : "medium",
      resolved: "none",
    };
  }

  return { patch: basePatch, confidence: "low", resolved: "none" };
}

export type InferredSourceMapping = {
  patch: SourceTextSchemaPatch;
  /** Confidence of the DETECTION itself (independent of the original scan being empty). */
  confidence: "high" | "medium" | "low";
};

/**
 * Detect a source/passage mapping AND report the detection confidence. The
 * confidence reflects what the probe actually resolved (inline text, passage
 * text, or identity-only) — NOT whether the originally-configured scan was empty.
 */
export async function inferSourceTextSchemaMapping(
  store: GraphStore,
  pack: ConnectDomainPack,
): Promise<InferredSourceMapping | null> {
  let tableNames: string[] = [];
  try {
    const info = await store.query<unknown>(`INFO FOR DB;`);
    tableNames = parseInfoForDb(Array.isArray(info) ? info[0] : info);
  } catch {
    return null;
  }
  if (tableNames.length === 0) return null;

  const tableMeta = await loadTableMeta(store, tableNames);
  if (tableMeta.length === 0) return null;

  const current = pack.graph_schema;
  const exclude = excludedSourceTables(pack);
  const sourceCandidates = rankSourceTables(current.source_table, exclude, tableMeta);
  const passageCandidates = rankPassageTables(current.passage_table, tableMeta);

  let best: {
    patch: SourceTextSchemaPatch;
    confidence: "high" | "medium" | "low";
    score: number;
  } | null = null;

  for (const sourceTable of sourceCandidates.slice(0, 6)) {
    const sampleRow = await sampleSourceRow(store, sourceTable);
    const meta = tableMeta.find((t) => t.name === sourceTable);
    const rowCount = meta?.count ?? 0;
    if (rowCount === 0) continue;

    for (const passageTable of passageCandidates.slice(0, 6)) {
      const result = await probeMapping(store, pack, sourceTable, passageTable, sampleRow);
      let score = rowCount;
      if (result.resolved === "passage") score += 2_000_000;
      if (result.resolved === "inline") score += 1_000_000;
      if (result.confidence === "high") score += 100_000;
      if (sourceTable === "source") score += 250_000;
      if (sampleRow && isBibliographicSourceRow(sampleRow)) score += 150_000;
      if (sourceTable === current.source_table && !isInvalidSourceTableMapping(pack)) {
        score += 10_000;
      }
      if (passageTable === current.passage_table) score += 5_000;
      if (exclude.has(sourceTable)) score -= 5_000_000;

      const patch = mergePatch(packPatchFromSchema(current), result.patch);
      if (!isSourceTablePatchAllowed(pack, patch)) continue;
      if (!best || score > best.score) {
        best = { patch, confidence: result.confidence, score };
      }
      if (result.resolved === "passage") break;
    }
    if (best && best.score >= 1_500_000) break;
  }

  if (!best || !isSourceTablePatchAllowed(pack, best.patch)) return null;
  return { patch: best.patch, confidence: best.confidence };
}

/** Back-compat: return only the patch (callers that don't need the confidence). */
export async function inferSourceTextSchemaPatch(
  store: GraphStore,
  pack: ConnectDomainPack,
): Promise<SourceTextSchemaPatch | null> {
  const inferred = await inferSourceTextSchemaMapping(store, pack);
  return inferred?.patch ?? null;
}

/** Table names whose DEFINE SQL marks them as relation/edge tables. */
function relationTableNames(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (!raw || typeof raw !== "object") return out;
  const tables = (raw as InfoForDb).tables;
  if (!tables || typeof tables !== "object") return out;
  for (const [name, def] of Object.entries(tables)) {
    if (typeof def === "string" && /TYPE\s+RELATION/i.test(def)) {
      const ident = tableIdent(name);
      if (ident) out.add(ident);
    }
  }
  return out;
}

/**
 * List the tables that might hold the operator's sources, surfaced when a scan
 * finds nothing so the UI can offer a manual mapping instead of asserting
 * "no sources". Returns normal tables with count > 0, excluding the configured
 * unit/group/passage tables, known skip tables, and relation/edge tables.
 */
export async function listCandidateSourceTables(
  store: GraphStore,
  pack: ConnectDomainPack,
): Promise<CandidateTable[]> {
  let rawInfo: unknown;
  try {
    rawInfo = await store.query<unknown>(`INFO FOR DB;`);
  } catch {
    return [];
  }
  const info = Array.isArray(rawInfo) ? rawInfo[0] : rawInfo;
  const tableNames = parseInfoForDb(info);
  if (tableNames.length === 0) return [];

  const exclude = excludedSourceTables(pack);
  const relations = relationTableNames(info);
  const candidates = tableNames.filter((name) => !exclude.has(name) && !relations.has(name));
  if (candidates.length === 0) return [];

  const meta = await loadTableMeta(store, candidates);
  return meta.map((t) => ({ name: t.name, count: t.count }));
}

export function buildSourceTextPackSuggestion(args: {
  pack: ConnectDomainPack;
  suggested: SourceTextSchemaPatch;
  confidence: "high" | "medium" | "low";
  reason: string;
}): SourceTextPackSuggestion | null {
  if (!isSourceTablePatchAllowed(args.pack, args.suggested)) return null;
  const current = packPatchFromSchema(args.pack.graph_schema);
  const changes = listChanges(current, args.suggested);
  if (changes.length === 0) return null;

  return {
    packId: args.pack.id,
    packTitle: args.pack.title,
    packSlug: args.pack.slug,
    canAutoApply: !args.pack.is_builtin,
    reason: args.reason,
    current,
    suggested: args.suggested,
    confidence: args.confidence,
    changes,
  };
}

export async function probeSourceTextPackSuggestion(args: {
  store: GraphStore;
  pack: ConnectDomainPack;
  sourceRowCount: number;
  withText: number;
  total: number;
}): Promise<SourceTextPackSuggestion | null> {
  if (!needsSchemaProbe(args)) return null;

  const inferred = await inferSourceTextSchemaMapping(args.store, args.pack);
  if (!inferred) return null;

  const reason = isInvalidSourceTableMapping(args.pack)
    ? `Source table is set to "${args.pack.graph_schema.source_table}" (same as your unit/idea table). Bibliographic sources live in a separate table — usually "source".`
    : args.sourceRowCount === 0
      ? "No rows were found in the configured source table — a different table may hold your sources."
      : "Sources were found but none resolved to full text with the current domain pack mapping.";

  // Surface the DETECTION confidence — a high-confidence detection (resolved inline
  // or passage text) should auto-apply even when the original scan was empty. The
  // previous code force-downgraded to "medium" whenever the scan was empty, which
  // blocked auto-healing for the very case that needs it (a wrong/empty mapping).
  return buildSourceTextPackSuggestion({
    pack: args.pack,
    suggested: inferred.patch,
    confidence: inferred.confidence,
    reason,
  });
}

export function patchesEqual(a: SourceTextSchemaPatch, b: SourceTextSchemaPatch): boolean {
  return listChanges(a, b).length === 0;
}
