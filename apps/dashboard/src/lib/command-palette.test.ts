/**
 * Tests for command palette filtering and navigation logic.
 *
 * These tests cover:
 * - filterNavCommands: fuzzy filtering of nav commands by query
 * - groupSearchResults: grouping of search result items by kind
 * - matchesQuery: per-item query matching
 * - loadRecentItems / saveRecentItem: localStorage round-trip
 *
 * pnpm --filter dashboard exec vitest run src/lib
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  filterNavCommands,
  groupSearchResults,
  matchesQuery,
  NAV_COMMANDS,
  type NavCommand,
  type SearchResultItem,
} from "./command-palette";

// ---------------------------------------------------------------------------
// filterNavCommands
// ---------------------------------------------------------------------------

describe("filterNavCommands", () => {
  const cmds: NavCommand[] = [
    { id: "nav:overview", label: "Overview", section: "Navigate", url: "/overview" },
    { id: "nav:connect", label: "Connect", section: "Navigate", url: "/connect" },
    { id: "nav:routes", label: "Routes", section: "Configure", url: "/routes" },
    { id: "nav:logs", label: "Logs", section: "Monitor", url: "/logs" },
    { id: "action:new-run", label: "New ingest run", section: "Actions", url: "/ingest/new" },
  ];

  it("returns all commands when query is empty", () => {
    expect(filterNavCommands(cmds, "")).toHaveLength(cmds.length);
    expect(filterNavCommands(cmds, "  ")).toHaveLength(cmds.length);
  });

  it("returns exact match first", () => {
    const results = filterNavCommands(cmds, "Logs");
    expect(results[0].id).toBe("nav:logs");
  });

  it("returns starts-with matches before contains", () => {
    const results = filterNavCommands(cmds, "con");
    // "Connect" starts with "con", "New ingest run" does not contain "con"
    expect(results[0].id).toBe("nav:connect");
  });

  it("is case-insensitive", () => {
    const results = filterNavCommands(cmds, "OVERVIEW");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("nav:overview");
  });

  it("returns empty array for no matches", () => {
    const results = filterNavCommands(cmds, "zzznomatch");
    expect(results).toHaveLength(0);
  });

  it("matches partial label substring", () => {
    const results = filterNavCommands(cmds, "ingest");
    expect(results.some((r) => r.id === "action:new-run")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesQuery
// ---------------------------------------------------------------------------

describe("matchesQuery", () => {
  const item: SearchResultItem = {
    kind: "project",
    id: "p1",
    title: "Restormel Keys API",
    subtitle: "Production project",
    url: "/projects/p1",
  };

  it("matches when query is empty", () => {
    expect(matchesQuery(item, "")).toBe(true);
    expect(matchesQuery(item, "  ")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesQuery(item, "KEYS")).toBe(true);
    expect(matchesQuery(item, "restormel")).toBe(true);
  });

  it("requires all tokens to match", () => {
    expect(matchesQuery(item, "restormel keys")).toBe(true);
    expect(matchesQuery(item, "restormel missing")).toBe(false);
  });

  it("can match tokens across title and subtitle", () => {
    expect(matchesQuery(item, "api production")).toBe(true);
  });

  it("returns false when no match", () => {
    expect(matchesQuery(item, "unrelated xyz")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// groupSearchResults
// ---------------------------------------------------------------------------

describe("groupSearchResults", () => {
  const items: SearchResultItem[] = [
    { kind: "project", id: "p1", title: "Project A", subtitle: null, url: "/p/1" },
    { kind: "route", id: "r1", title: "Route X", subtitle: "Project A", url: "/r/1" },
    { kind: "route", id: "r2", title: "Route Y", subtitle: "Project B", url: "/r/2" },
    { kind: "policy", id: "pol1", title: "Block GPT-3", subtitle: "model_denylist", url: "/pol/1" },
    { kind: "graph_unit", id: "u1", title: "Unit text here", subtitle: "unvalidated", url: "/g?unit=u1" },
  ];

  it("groups items by kind", () => {
    const groups = groupSearchResults(items);
    const routeGroup = groups.find((g) => g.kind === "route");
    expect(routeGroup?.items).toHaveLength(2);
  });

  it("preserves order within each kind", () => {
    const groups = groupSearchResults(items);
    const routes = groups.find((g) => g.kind === "route")!.items;
    expect(routes[0].id).toBe("r1");
    expect(routes[1].id).toBe("r2");
  });

  it("orders groups: project → route → policy → gateway_key → model → ingest_run → graph_unit", () => {
    const groups = groupSearchResults(items);
    const kinds = groups.map((g) => g.kind);
    expect(kinds.indexOf("project")).toBeLessThan(kinds.indexOf("route"));
    expect(kinds.indexOf("route")).toBeLessThan(kinds.indexOf("graph_unit"));
  });

  it("omits empty kinds", () => {
    const groups = groupSearchResults(items);
    expect(groups.find((g) => g.kind === "gateway_key")).toBeUndefined();
    expect(groups.find((g) => g.kind === "model")).toBeUndefined();
  });

  it("returns empty array for empty input", () => {
    expect(groupSearchResults([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// NAV_COMMANDS registry invariants
// ---------------------------------------------------------------------------

describe("NAV_COMMANDS registry", () => {
  it("has no duplicate ids", () => {
    const ids = NAV_COMMANDS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every command has a non-empty url", () => {
    for (const cmd of NAV_COMMANDS) {
      expect(cmd.url.length).toBeGreaterThan(0);
    }
  });

  it("every command has a non-empty label", () => {
    for (const cmd of NAV_COMMANDS) {
      expect(cmd.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("contains key navigation destinations from the target IA (§2.2)", () => {
    const ids = new Set(NAV_COMMANDS.map((c) => c.id));
    expect(ids.has("nav:home")).toBe(true);
    expect(ids.has("nav:sources")).toBe(true);
    expect(ids.has("nav:runs")).toBe(true);
    expect(ids.has("nav:claims")).toBe(true);
    expect(ids.has("nav:prove")).toBe(true);
    expect(ids.has("nav:agents")).toBe(true);
    expect(ids.has("nav:projects")).toBe(true);
    expect(ids.has("nav:routes")).toBe(true);
    expect(ids.has("nav:logs")).toBe(true);
    expect(ids.has("nav:settings")).toBe(true);
  });

  it("registers no dissolved /connect URLs (R2)", () => {
    for (const cmd of NAV_COMMANDS) {
      expect(cmd.url.includes("/connect"), `${cmd.id} still points at /connect`).toBe(false);
    }
  });

  it("contains the quick-action for 'Review flagged claims'", () => {
    const claims = NAV_COMMANDS.find((c) => c.id === "action:review-claims");
    expect(claims).toBeDefined();
    expect(claims?.url).toContain("filter=review");
  });
});

// ---------------------------------------------------------------------------
// Recent items (mocked localStorage)
// ---------------------------------------------------------------------------

describe("recent items", () => {
  beforeEach(() => {
    // Provide a minimal localStorage stub for Node environment
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  it("returns empty array when nothing stored", async () => {
    const { loadRecentItems } = await import("./command-palette");
    expect(loadRecentItems()).toHaveLength(0);
  });

  it("saves and loads a recent item", async () => {
    const { loadRecentItems, saveRecentItem } = await import("./command-palette");
    saveRecentItem({ id: "nav:routes", label: "Routes", url: "/routes", kind: "nav", visitedAt: Date.now() });
    const items = loadRecentItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("nav:routes");
  });

  it("deduplicates by id (newest wins)", async () => {
    const { loadRecentItems, saveRecentItem } = await import("./command-palette");
    const t = Date.now();
    saveRecentItem({ id: "nav:connect", label: "Connect", url: "/connect", kind: "nav", visitedAt: t });
    saveRecentItem({ id: "nav:connect", label: "Connect", url: "/connect", kind: "nav", visitedAt: t + 1000 });
    const items = loadRecentItems();
    expect(items.filter((i) => i.id === "nav:connect")).toHaveLength(1);
    expect(items[0].visitedAt).toBe(t + 1000);
  });

  it("caps at RECENT_ITEMS_MAX", async () => {
    const { loadRecentItems, saveRecentItem, RECENT_ITEMS_MAX } = await import("./command-palette");
    for (let i = 0; i < RECENT_ITEMS_MAX + 3; i++) {
      saveRecentItem({ id: `nav:item-${i}`, label: `Item ${i}`, url: `/item/${i}`, kind: "nav", visitedAt: Date.now() + i });
    }
    expect(loadRecentItems()).toHaveLength(RECENT_ITEMS_MAX);
  });
});
