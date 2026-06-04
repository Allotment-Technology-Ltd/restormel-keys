import { describe, expect, it } from "vitest";
import {
  parseSurrealTableDefine,
  suggestGraphSchemaFromTables,
  type SurrealTableIntrospection,
} from "./surreal-schema-introspect";

const SOPHIA_DEFINES = {
  source: "DEFINE TABLE IF NOT EXISTS source SCHEMAFULL;",
  claim: "DEFINE TABLE IF NOT EXISTS claim SCHEMAFULL;",
  argument: "DEFINE TABLE IF NOT EXISTS argument SCHEMAFULL;",
  passage: "DEFINE TABLE IF NOT EXISTS passage SCHEMAFULL;",
  supports: "DEFINE TABLE IF NOT EXISTS supports TYPE RELATION IN claim OUT claim SCHEMAFULL;",
  contradicts: "DEFINE TABLE IF NOT EXISTS contradicts TYPE RELATION IN claim OUT claim SCHEMAFULL;",
  part_of: "DEFINE TABLE IF NOT EXISTS part_of TYPE RELATION IN claim OUT argument SCHEMAFULL;",
};

function table(name: string, extra: Partial<SurrealTableIntrospection> = {}): SurrealTableIntrospection {
  const parsed = parseSurrealTableDefine(SOPHIA_DEFINES[name as keyof typeof SOPHIA_DEFINES] ?? "");
  return {
    name,
    kind: parsed.kind,
    count: extra.count ?? 10,
    relation_in: parsed.relation_in,
    relation_out: parsed.relation_out,
    has_text_field: extra.has_text_field,
    ...extra,
  };
}

describe("parseSurrealTableDefine", () => {
  it("detects relation tables with IN/OUT", () => {
    expect(parseSurrealTableDefine(SOPHIA_DEFINES.supports)).toEqual({
      kind: "relation",
      relation_in: "claim",
      relation_out: "claim",
    });
  });

  it("detects normal tables", () => {
    expect(parseSurrealTableDefine(SOPHIA_DEFINES.claim)).toEqual({ kind: "normal" });
  });
});

describe("suggestGraphSchemaFromTables", () => {
  it("maps SOPHIA-shaped schema to Connect graph_schema roles", () => {
    const tables = [
      table("source"),
      table("passage"),
      table("claim", { count: 500, has_text_field: true }),
      table("argument", { count: 40 }),
      table("supports"),
      table("contradicts"),
      table("part_of"),
    ];
    const { suggested } = suggestGraphSchemaFromTables(tables);
    expect(suggested.unit_table).toBe("claim");
    expect(suggested.group_table).toBe("argument");
    expect(suggested.part_of_edge).toBe("part_of");
    expect(suggested.relation_edges).toEqual(expect.arrayContaining(["supports", "contradicts"]));
  });
});
