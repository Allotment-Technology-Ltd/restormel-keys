import { describe, expect, it } from "vitest";
import {
  assertToolAllowedReadonly,
  evaluateReadonlyTool,
  filterReadonlyTools,
  isReadonlyToolName,
  isToolAllowedReadonly,
} from "./connect-readonly-profile";

describe("connect-readonly profile (deny-by-default)", () => {
  it("classifies read/query/verify-class tools as allowed", () => {
    for (const name of [
      "get_document",
      "list_tools",
      "search-docs",
      "queryGraph",
      "verify_claim",
      "describe_table",
      "fetchResource",
      "health_check",
    ]) {
      expect(isReadonlyToolName(name)).toBe(true);
    }
  });

  it("classifies write/admin/mutate tools as denied", () => {
    for (const name of [
      "create_document",
      "delete_node",
      "update_record",
      "drop_table",
      "admin_reset",
      "execute_sql",
      "send_email",
      "deploy_service",
      "grant_access",
    ]) {
      expect(isReadonlyToolName(name)).toBe(false);
    }
  });

  it("denies an unknown tool (deny-by-default; not in the read allow-set)", () => {
    expect(isReadonlyToolName("frobnicate")).toBe(false);
    expect(isReadonlyToolName("xyzzy")).toBe(false);
    expect(isReadonlyToolName("")).toBe(false);
  });

  it("denies a tool that mixes a read verb with a write verb", () => {
    expect(isReadonlyToolName("get_and_delete")).toBe(false);
    expect(isReadonlyToolName("list_then_update")).toBe(false);
  });

  it("HIDES a write/admin tool from listTools (filterReadonlyTools)", () => {
    const tools = [
      { name: "search_docs" },
      { name: "delete_document" }, // write — must be hidden
      { name: "get_status" },
      { name: "admin_purge" }, // admin — must be hidden
    ];
    const visible = filterReadonlyTools(tools).map((t) => t.name);
    expect(visible).toEqual(["search_docs", "get_status"]);
    expect(visible).not.toContain("delete_document");
    expect(visible).not.toContain("admin_purge");
  });

  it("REJECTS a hidden write tool on dispatch even if the client knows its name", () => {
    // Defence at the second point: dispatch-time check.
    expect(isToolAllowedReadonly("delete_document")).toBe(false);
    const rejected = assertToolAllowedReadonly("delete_document");
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.status).toBe(403);
      expect(rejected.error).toBe("tool_not_allowed");
    }
    // And a legit read tool dispatches fine.
    expect(assertToolAllowedReadonly("search_docs")).toEqual({ ok: true });
  });

  it("honours an explicit destructive annotation regardless of a read-looking name", () => {
    const decision = evaluateReadonlyTool({
      name: "get_thing",
      annotations: { destructiveHint: true },
    });
    expect(decision.allowed).toBe(false);
  });

  it("intersects with a per-target allowedTools list (narrows, never widens)", () => {
    const tools = [{ name: "search_docs" }, { name: "get_status" }, { name: "list_items" }];
    const visible = filterReadonlyTools(tools, ["search_docs", "list_items"]).map((t) => t.name);
    expect(visible).toEqual(["search_docs", "list_items"]);
    // allowedTools cannot re-admit a write tool that the readonly profile denies.
    expect(isToolAllowedReadonly("delete_document", { allowedTools: ["delete_document"] })).toBe(
      false,
    );
  });
});
