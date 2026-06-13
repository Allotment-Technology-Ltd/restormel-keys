/**
 * Introspect a Bring-Your-Own SurrealDB namespace/database and suggest a Connect
 * domain pack graph_schema mapping (tables + relation edges).
 */
import type { ConnectDomainPackUpsert } from "@restormel/contracts/connect";
import { DEFAULT_GENERIC_DOMAIN_PACK, ConnectDomainPackUpsertSchema } from "@restormel/contracts/connect";
import type { GraphStore } from "@restormel/graphrag-core";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { slugify } from "$lib/server/connect/designer-map";
import { VECTOR_FIELD_CANDIDATES } from "$lib/server/connect/surreal-graph-units-load";

export type SurrealTableKind = "normal" | "relation" | "unknown";

export type SurrealTableIntrospection = {
  name: string;
  kind: SurrealTableKind;
  count: number;
  define_sql?: string;
  relation_in?: string;
  relation_out?: string;
  has_text_field?: boolean;
  embedding_dim_sample?: number;
  /** Field name the embedding vector was found under (e.g. `embedding`, `vector`). */
  embedding_field_sample?: string;
};

export type SurrealSchemaSuggestion = {
  source_table: string;
  passage_table: string;
  unit_table: string;
  group_table: string;
  part_of_edge: string;
  relation_edges: string[];
};

export type SurrealSchemaIntrospection = {
  ok: true;
  namespace: string;
  database: string;
  tables: SurrealTableIntrospection[];
  suggested: SurrealSchemaSuggestion;
  warnings: string[];
  draft: ConnectDomainPackUpsert;
};

export type SurrealSchemaIntrospectionFailure = {
  ok: false;
  error: string;
  message: string;
};

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function tableIdent(name: string, fallback: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return SAFE_IDENT.test(s) ? s : fallback;
}

const SKIP_UNIT_CANDIDATES = new Set([
  "source",
  "passage",
  "review_audit_log",
  "query_cache",
  "link_ingestion_queue",
  "thinker_resolution_audit_log",
  "thinker_alias",
  "unresolved_thinker_reference",
]);

/** Parse DEFINE TABLE … from INFO FOR DB / INFO FOR TABLE. */
export function parseSurrealTableDefine(defineSql: string): {
  kind: SurrealTableKind;
  relation_in?: string;
  relation_out?: string;
} {
  const sql = defineSql.trim();
  if (!sql) return { kind: "unknown" };
  if (/TYPE\s+RELATION/i.test(sql)) {
    const inMatch = sql.match(/\bIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    const outMatch = sql.match(/\bOUT\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    return {
      kind: "relation",
      relation_in: inMatch?.[1]?.toLowerCase(),
      relation_out: outMatch?.[1]?.toLowerCase(),
    };
  }
  if (/DEFINE\s+TABLE/i.test(sql)) return { kind: "normal" };
  return { kind: "unknown" };
}

function pickName(candidates: string[], names: Set<string>, fallbacks: string[]): string | undefined {
  for (const c of candidates) if (names.has(c)) return c;
  for (const f of fallbacks) if (names.has(f)) return f;
  return undefined;
}

/** Pure suggestion from parsed table metadata (unit-testable). */
export function suggestGraphSchemaFromTables(
  tables: SurrealTableIntrospection[],
): { suggested: SurrealSchemaSuggestion; warnings: string[] } {
  const warnings: string[] = [];
  const names = new Set(tables.map((t) => t.name));
  const normals = tables.filter((t) => t.kind === "normal");
  const relations = tables.filter((t) => t.kind === "relation");

  const passage_table =
    pickName(["passage"], names, []) ??
    normals.find((t) => t.name.includes("passage"))?.name ??
    "passage";

  const unitCandidates = normals
    .filter((t) => !SKIP_UNIT_CANDIDATES.has(t.name) && t.name !== passage_table)
    .sort((a, b) => {
      const score = (t: SurrealTableIntrospection) => {
        let s = t.count;
        if (t.has_text_field) s += 1_000_000;
        if (["claim", "statement", "unit", "node"].includes(t.name)) s += 500_000;
        return s;
      };
      return score(b) - score(a);
    });

  const unit_table =
    pickName(["claim", "statement", "unit"], names, []) ??
    unitCandidates[0]?.name ??
    "unit";

  if (!names.has(unit_table)) {
    warnings.push(`Suggested unit table "${unit_table}" was not found — pick a table manually.`);
  }

  // Source-table selection mirrors unit detection: score normal tables (excluding
  // unit/group/passage/relations/skip) by has_text_field, a source-name hint, and
  // row count. Prefer an exact `source`/`sources`. Never hard-fall-back to a phantom
  // literal "source" — leave a sentinel + warning when nothing source-like exists,
  // so the operator can map manually instead of being told "no sources".
  const SOURCE_NAME_HINTS = new Set([
    "source",
    "sources",
    "document",
    "documents",
    "doc",
    "paper",
    "article",
    "corpus",
    "reference",
    "ref",
    "publication",
    "book",
    "dataset",
    "file",
  ]);
  const relationNames = new Set(relations.map((r) => r.name));
  const sourceCandidates = normals
    .filter(
      (t) =>
        t.name !== unit_table &&
        t.name !== passage_table &&
        !relationNames.has(t.name),
    )
    .map((t) => {
      let score = t.count;
      if (t.has_text_field) score += 1_000_000;
      if (SOURCE_NAME_HINTS.has(t.name)) score += 500_000;
      if (t.name === "source" || t.name === "sources") score += 250_000;
      return { table: t, score };
    })
    .sort((a, b) => b.score - a.score);

  const SOURCE_TABLE_SENTINEL = "__unknown_source__";
  let source_table: string;
  if (names.has("source") && unit_table !== "source" && passage_table !== "source") {
    source_table = "source";
  } else if (names.has("sources") && unit_table !== "sources" && passage_table !== "sources") {
    source_table = "sources";
  } else if (sourceCandidates.length > 0) {
    source_table = sourceCandidates[0]!.table.name;
  } else {
    source_table = SOURCE_TABLE_SENTINEL;
    warnings.push(
      "No source-like table detected — pick the table that holds your bibliographic sources manually.",
    );
  }
  if (source_table !== SOURCE_TABLE_SENTINEL && !names.has(source_table)) {
    warnings.push(`Suggested source table "${source_table}" was not found — pick a table manually.`);
  }

  const partOf = relations.find((r) => r.name === "part_of" || r.name.endsWith("_part_of"));
  const groupFromPartOf = partOf?.relation_out;

  const group_table =
    groupFromPartOf ??
    pickName(["argument", "topic", "group", "cluster"], names, []) ??
    normals.find((t) => t.name !== unit_table && t.name !== source_table && t.count > 0)?.name ??
    "group";

  const part_of_edge = partOf?.name ?? "part_of";

  const relation_edges = relations
    .filter(
      (r) =>
        r.relation_in === unit_table &&
        r.relation_out === unit_table &&
        r.name !== part_of_edge,
    )
    .map((r) => r.name)
    .sort();

  if (relation_edges.length === 0) {
    warnings.push(
      "No unit→unit relation tables detected. Add relation edge names manually if your schema uses different names.",
    );
  }

  const suggested: SurrealSchemaSuggestion = {
    source_table,
    passage_table,
    unit_table,
    group_table,
    part_of_edge: names.has(part_of_edge) ? part_of_edge : "part_of",
    relation_edges,
  };

  return { suggested, warnings };
}

export function buildDomainPackFromSurrealSchema(args: {
  title: string;
  slug?: string;
  description?: string;
  mapping: SurrealSchemaSuggestion;
  embeddingDimensions?: number;
  /** Field the unit table stores embeddings under (detected during introspection). */
  vectorField?: string;
}): ConnectDomainPackUpsert {
  const gen = DEFAULT_GENERIC_DOMAIN_PACK;
  const unitNoun = args.mapping.unit_table.replace(/_/g, " ");
  const groupNoun = args.mapping.group_table.replace(/_/g, " ");
  const relation_types =
    args.mapping.relation_edges.length > 0
      ? args.mapping.relation_edges.map((name) => ({
          name,
          description: `Relation edge table ${name}`,
        }))
      : gen.ontology.relation_types;

  const candidate: ConnectDomainPackUpsert = {
    slug: slugify(args.slug ?? args.title, "surreal-import"),
    title: args.title,
    description:
      args.description ??
      "Imported from an existing SurrealDB graph schema. Review ontology and prompts before production ingest.",
    ontology: {
      ...gen.ontology,
      unit_noun: unitNoun,
      group_noun: groupNoun,
      relation_types,
      schema_mode: "guided",
    },
    graph_schema: {
      source_table: tableIdent(args.mapping.source_table, "source"),
      passage_table: tableIdent(args.mapping.passage_table, "passage"),
      unit_table: tableIdent(args.mapping.unit_table, "unit"),
      group_table: tableIdent(args.mapping.group_table, "group"),
      part_of_edge: tableIdent(args.mapping.part_of_edge, "part_of"),
      relation_edges: args.mapping.relation_edges.map((e) => tableIdent(e, "relates_to")),
      unit_vector_field: args.vectorField ?? "embedding",
    },
    passage_profile: gen.passage_profile,
    chunking: gen.chunking,
    parser: gen.parser,
    embedding: {
      model: gen.embedding.model,
      dimensions: args.embeddingDimensions ?? gen.embedding.dimensions,
    },
  };

  return ConnectDomainPackUpsertSchema.parse(candidate);
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

const TEXT_FIELD_PROBE = ["text", "body", "content", "full_text", "raw_text"] as const;

async function tableHasTextField(store: GraphStore, table: string): Promise<boolean> {
  if (!SAFE_IDENT.test(table)) return false;
  for (const field of TEXT_FIELD_PROBE) {
    try {
      const rows = await store.query<Record<string, unknown>[]>(
        `SELECT ${field} FROM ${table} WHERE ${field} IS NOT NONE LIMIT 1;`,
      );
      if (rows.some((r) => typeof r[field] === "string" && String(r[field]).trim())) {
        return true;
      }
    } catch {
      // try next field
    }
  }
  return false;
}

/**
 * Sample the embedding vector's dimension and the field it lives under. Probes
 * common field names so a BYO graph storing vectors as `vector` (etc.) is detected.
 */
async function sampleEmbedding(
  store: GraphStore,
  table: string,
): Promise<{ dim?: number; field?: string }> {
  if (!SAFE_IDENT.test(table)) return {};
  for (const field of VECTOR_FIELD_CANDIDATES) {
    try {
      const rows = await store.query<{ dim?: number }[]>(
        `SELECT array::len(${field}) AS dim FROM ${table} WHERE ${field} IS NOT NONE LIMIT 1;`,
      );
      const dim = rows[0]?.dim;
      if (typeof dim === "number" && dim > 0) return { dim, field };
    } catch {
      // try the next candidate
    }
  }
  return {};
}

type InfoForDb = { tables?: Record<string, string> };

function parseInfoForDb(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const tables = (raw as InfoForDb).tables;
  if (!tables || typeof tables !== "object") return {};
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(tables)) {
    if (typeof def === "string") out[name.toLowerCase()] = def;
  }
  return out;
}

export async function introspectSurrealGraphSchema(
  workspaceId: string,
): Promise<SurrealSchemaIntrospection | SurrealSchemaIntrospectionFailure> {
  const target = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!target || target.provider !== "surreal") {
    return {
      ok: false,
      error: "no_surreal_target",
      message: "Connect a SurrealDB graph store before importing a schema.",
    };
  }
  if (target.status !== "ok") {
    return {
      ok: false,
      error: "target_not_ready",
      message: "Test your SurrealDB connection on the Graph store step before importing a schema.",
    };
  }

  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) {
    return {
      ok: false,
      error: "store_unreachable",
      message: "Could not reach your SurrealDB store. Re-test the connection and try again.",
    };
  }

  let tableDefs: Record<string, string>;
  try {
    const info = await store.query<unknown>(`INFO FOR DB;`);
    tableDefs = parseInfoForDb(Array.isArray(info) ? info[0] : info);
  } catch (e) {
    return {
      ok: false,
      error: "info_for_db_failed",
      message: e instanceof Error ? e.message : "INFO FOR DB failed on Surreal.",
    };
  }

  const tableNames = Object.keys(tableDefs);
  if (tableNames.length === 0) {
    return {
      ok: false,
      error: "empty_schema",
      message: "No tables found in this Surreal database. Define your schema in Surreal first, or ingest using a Restormel-designed pack.",
    };
  }

  const tables: SurrealTableIntrospection[] = [];
  const introspectionWarnings: string[] = [];
  for (const name of tableNames.sort()) {
    if (!SAFE_IDENT.test(name)) {
      introspectionWarnings.push(`Skipped table "${name}" — name is not a safe Surreal identifier.`);
      continue;
    }
    const define_sql = tableDefs[name];
    const parsed = parseSurrealTableDefine(define_sql ?? "");
    const count = await tableCount(store, name);
    const has_text_field =
      parsed.kind === "normal" ? await tableHasTextField(store, name) : undefined;
    const embeddingSample =
      parsed.kind === "normal" ? await sampleEmbedding(store, name) : {};
    tables.push({
      name,
      kind: parsed.kind,
      count,
      define_sql,
      relation_in: parsed.relation_in,
      relation_out: parsed.relation_out,
      has_text_field,
      embedding_dim_sample: embeddingSample.dim,
      embedding_field_sample: embeddingSample.field,
    });
  }

  const { suggested, warnings: suggestionWarnings } = suggestGraphSchemaFromTables(tables);
  const warnings = [...introspectionWarnings, ...suggestionWarnings];

  const sourceRow = tables.find((t) => t.name === suggested.source_table);
  const passageRow = tables.find((t) => t.name === suggested.passage_table);
  const passageBackedText = Boolean(
    sourceRow && passageRow && !sourceRow.has_text_field && passageRow.has_text_field,
  );
  if (passageBackedText) {
    warnings.push(
      "Full text is stored in the passage table, not on source records. Connect will resolve source text from linked passages during graph scans and re-validation.",
    );
  }
  const unitRow = tables.find((t) => t.name === suggested.unit_table);
  const title = `Surreal — ${suggested.unit_table} / ${suggested.group_table}`;
  let draft = buildDomainPackFromSurrealSchema({
    title,
    slug: `${suggested.unit_table}-surreal`,
    mapping: suggested,
    embeddingDimensions: unitRow?.embedding_dim_sample,
    vectorField: unitRow?.embedding_field_sample,
  });
  if (passageBackedText) {
    draft = {
      ...draft,
      graph_schema: {
        ...draft.graph_schema,
        passage_text_field: draft.graph_schema.passage_text_field ?? "text",
        passage_source_field: draft.graph_schema.passage_source_field ?? "source",
      },
    };
  }

  return {
    ok: true,
    namespace: target.namespace ?? "",
    database: target.database ?? "",
    tables,
    suggested,
    warnings,
    draft,
  };
}

/** Apply operator overrides before saving an imported pack. */
export function mergeSurrealSchemaImport(args: {
  introspection: SurrealSchemaIntrospection;
  title?: string;
  slug?: string;
  mapping?: Partial<SurrealSchemaSuggestion>;
}): ConnectDomainPackUpsert {
  const mapping: SurrealSchemaSuggestion = {
    ...args.introspection.suggested,
    ...args.mapping,
    relation_edges: args.mapping?.relation_edges ?? args.introspection.suggested.relation_edges,
  };
  return buildDomainPackFromSurrealSchema({
    title: args.title?.trim() || args.introspection.draft.title,
    slug: args.slug?.trim() || args.introspection.draft.slug,
    mapping,
    embeddingDimensions: args.introspection.tables.find((t) => t.name === mapping.unit_table)
      ?.embedding_dim_sample,
    vectorField: args.introspection.tables.find((t) => t.name === mapping.unit_table)
      ?.embedding_field_sample,
  });
}
