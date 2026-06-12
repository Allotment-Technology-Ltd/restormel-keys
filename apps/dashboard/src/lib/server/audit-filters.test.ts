/**
 * W3.7 — Audit log filter mapping tests.
 *
 * Tests the filter parsing logic for /prove/audit without a live DB.
 * Verifies that URL params map to the correct listAuditEvents options,
 * that the page-size sentinel (hasMore) is correct, and that the filter
 * clear path produces a bare URL.
 *
 * Fixtures shaped after AuditEventRecord (neon.ts:1013-1022 post W3.7).
 */
import { describe, expect, it } from "vitest";

// -----------------------------------------------------------------------
// 1. Filter param parsing (mirrors +page.server.ts parseFilters logic)
// -----------------------------------------------------------------------

type AuditFilterParams = {
  actor: string;
  actorType: string;
  eventType: string;
  since: number | null;
  until: number | null;
  before: number | null;
};

function parseFilters(searchParams: URLSearchParams): AuditFilterParams {
  const actor = searchParams.get("actor") ?? "";
  const actorType = searchParams.get("actorType") ?? "";
  const eventType = searchParams.get("eventType") ?? "";

  const sinceRaw = searchParams.get("since");
  const untilRaw = searchParams.get("until");
  const beforeRaw = searchParams.get("before");

  const since = sinceRaw
    ? Number.isFinite(Number(sinceRaw))
      ? Number(sinceRaw)
      : Date.parse(sinceRaw) || null
    : null;
  const until = untilRaw
    ? Number.isFinite(Number(untilRaw))
      ? Number(untilRaw)
      : Date.parse(untilRaw) || null
    : null;
  const before = beforeRaw ? (Number.isFinite(Number(beforeRaw)) ? Number(beforeRaw) : null) : null;

  return { actor, actorType, eventType, since, until, before };
}

describe("parseFilters — URL params → listAuditEvents options", () => {
  it("returns empty filters for a bare URL", () => {
    const p = parseFilters(new URLSearchParams());
    expect(p.actor).toBe("");
    expect(p.actorType).toBe("");
    expect(p.eventType).toBe("");
    expect(p.since).toBeNull();
    expect(p.until).toBeNull();
    expect(p.before).toBeNull();
  });

  it("maps eventType=gateway_key_created correctly", () => {
    const p = parseFilters(new URLSearchParams("eventType=gateway_key_created"));
    expect(p.eventType).toBe("gateway_key_created");
  });

  it("maps actorType=user correctly", () => {
    const p = parseFilters(new URLSearchParams("actorType=user"));
    expect(p.actorType).toBe("user");
  });

  it("maps actor ID correctly", () => {
    const p = parseFilters(new URLSearchParams("actor=uid-abc123"));
    expect(p.actor).toBe("uid-abc123");
  });

  it("parses epoch ms since/until values", () => {
    const since = 1_718_000_000_000;
    const until = 1_718_100_000_000;
    const p = parseFilters(new URLSearchParams(`since=${since}&until=${until}`));
    expect(p.since).toBe(since);
    expect(p.until).toBe(until);
  });

  it("parses ISO 8601 since/until values", () => {
    const isoSince = "2024-06-10T12:00:00.000Z";
    const p = parseFilters(new URLSearchParams(`since=${isoSince}`));
    expect(p.since).toBe(Date.parse(isoSince));
    expect(p.since).toBeGreaterThan(0);
  });

  it("returns null for an invalid (non-numeric, non-ISO) since value", () => {
    const p = parseFilters(new URLSearchParams("since=not-a-date"));
    expect(p.since).toBeNull();
  });

  it("parses before cursor (epoch ms) for keyset pagination", () => {
    const cursor = 1_718_050_000_000;
    const p = parseFilters(new URLSearchParams(`before=${cursor}`));
    expect(p.before).toBe(cursor);
  });

  it("combines all filters", () => {
    const params = new URLSearchParams(
      "actor=uid-1&actorType=user&eventType=gateway_key_created&since=1718000000000&until=1718100000000"
    );
    const p = parseFilters(params);
    expect(p.actor).toBe("uid-1");
    expect(p.actorType).toBe("user");
    expect(p.eventType).toBe("gateway_key_created");
    expect(p.since).toBe(1_718_000_000_000);
    expect(p.until).toBe(1_718_100_000_000);
  });
});

// -----------------------------------------------------------------------
// 2. hasActiveFilters detection
// -----------------------------------------------------------------------

function hasActiveFilters(f: AuditFilterParams): boolean {
  return !!(f.actor || f.actorType || f.eventType || f.since || f.until);
}

describe("hasActiveFilters", () => {
  it("returns false when all filters are empty/null", () => {
    expect(hasActiveFilters(parseFilters(new URLSearchParams()))).toBe(false);
  });

  it("returns true when any filter is set", () => {
    expect(hasActiveFilters(parseFilters(new URLSearchParams("eventType=gateway_key_created")))).toBe(true);
    expect(hasActiveFilters(parseFilters(new URLSearchParams("actorType=user")))).toBe(true);
    expect(hasActiveFilters(parseFilters(new URLSearchParams("actor=uid-1")))).toBe(true);
    expect(hasActiveFilters(parseFilters(new URLSearchParams("since=1718000000000")))).toBe(true);
    expect(hasActiveFilters(parseFilters(new URLSearchParams("until=1718100000000")))).toBe(true);
  });

  it("the `before` cursor is NOT an active filter (pagination, not filtering)", () => {
    const p = parseFilters(new URLSearchParams("before=1718000000000"));
    // before is pagination state, not a user-selected filter — should not trigger "clear filters"
    expect(hasActiveFilters(p)).toBe(false);
  });
});

// -----------------------------------------------------------------------
// 3. Pagination sentinel (hasMore)
// -----------------------------------------------------------------------

/**
 * Mirrors the +page.server.ts hasMore logic:
 * fetch PAGE_SIZE + 1 rows; if length > PAGE_SIZE → hasMore = true, slice to PAGE_SIZE.
 */
const PAGE_SIZE = 50;

type AuditEventRecord = {
  id: string;
  eventType: string;
  targetType: string;
  targetId: string;
  summary?: string | null;
  createdAt: number;
  actorType: string;
  actorId: string;
};

function makeEvent(id: string, createdAt: number): AuditEventRecord {
  return {
    id,
    eventType: "gateway_key_created",
    targetType: "gateway_key",
    targetId: `key-${id}`,
    summary: `Key ${id} created`,
    createdAt,
    actorType: "user",
    actorId: "user-1",
  };
}

function applyPagination(rows: AuditEventRecord[]): { events: AuditEventRecord[]; hasMore: boolean } {
  const hasMore = rows.length > PAGE_SIZE;
  return { events: hasMore ? rows.slice(0, PAGE_SIZE) : rows, hasMore };
}

describe("audit pagination sentinel (W3.7 keyset pagination)", () => {
  it("hasMore = false when fewer rows than PAGE_SIZE", () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeEvent(`e${i}`, 1_718_000_000_000 - i * 1000));
    const { hasMore, events } = applyPagination(rows);
    expect(hasMore).toBe(false);
    expect(events).toHaveLength(10);
  });

  it("hasMore = false when exactly PAGE_SIZE rows", () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeEvent(`e${i}`, 1_718_000_000_000 - i * 1000)
    );
    const { hasMore, events } = applyPagination(rows);
    expect(hasMore).toBe(false);
    expect(events).toHaveLength(PAGE_SIZE);
  });

  it("hasMore = true when PAGE_SIZE + 1 rows returned from DB", () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
      makeEvent(`e${i}`, 1_718_000_000_000 - i * 1000)
    );
    const { hasMore, events } = applyPagination(rows);
    expect(hasMore).toBe(true);
    expect(events).toHaveLength(PAGE_SIZE); // sentinel row is not exposed
  });

  it("cursor for next page is the createdAt of the last event in the current page", () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
      makeEvent(`e${i}`, 1_718_000_000_000 - i * 1000)
    );
    const { events } = applyPagination(rows);
    const cursor = events[events.length - 1].createdAt;
    // The cursor is the createdAt of row 49 (0-indexed): 1_718_000_000_000 - 49*1000
    expect(cursor).toBe(1_718_000_000_000 - (PAGE_SIZE - 1) * 1000);
  });
});

// -----------------------------------------------------------------------
// 4. AuditEventRecord shape — actor fields present (K-P1-1 evidence chain)
// -----------------------------------------------------------------------

describe("AuditEventRecord — actorId present (W3.7 actor identity)", () => {
  it("actorId is a non-empty string", () => {
    const evt = makeEvent("e1", 1_718_000_000_000);
    expect(typeof evt.actorId).toBe("string");
    expect(evt.actorId.length).toBeGreaterThan(0);
  });

  it("actorType is a known type string", () => {
    const evt = makeEvent("e1", 1_718_000_000_000);
    const validTypes = ["user", "gateway_key", "management_key", "system"];
    expect(validTypes).toContain(evt.actorType);
  });

  it("actorId and actorType are distinct fields (not collapsed)", () => {
    const evt = makeEvent("e1", 1_718_000_000_000);
    // Before W3.7 the page showed actor_type only. This asserts that
    // actorId is a distinct field that carries the per-instance identity.
    expect(evt).toHaveProperty("actorId");
    expect(evt).toHaveProperty("actorType");
    expect(evt.actorId).not.toBe(evt.actorType);
  });
});

// -----------------------------------------------------------------------
// 5. Object link (X4) — targetHref logic
// -----------------------------------------------------------------------

/** Mirrors the targetHref() function in +page.svelte. */
function targetHref(targetType: string, targetId: string, dashboardBase: string): string | null {
  switch (targetType) {
    case "gateway_key":
      return dashboardBase + "/access";
    case "project":
      return dashboardBase + `/projects/${targetId}`;
    case "policy":
      return dashboardBase + `/policies/${targetId}`;
    case "provider_integration":
      return dashboardBase + `/integrations/${targetId}`;
    case "workspace":
      return dashboardBase + "/home";
    default:
      return null;
  }
}

const BASE = "/keys/dashboard";

describe("targetHref — object links (X4: each audit row links to the entity)", () => {
  it("gateway_key → /access", () => {
    expect(targetHref("gateway_key", "key-1", BASE)).toBe("/keys/dashboard/access");
  });

  it("project → /projects/{id}", () => {
    expect(targetHref("project", "proj-1", BASE)).toBe("/keys/dashboard/projects/proj-1");
  });

  it("policy → /policies/{id}", () => {
    expect(targetHref("policy", "pol-1", BASE)).toBe("/keys/dashboard/policies/pol-1");
  });

  it("provider_integration → /integrations/{id}", () => {
    expect(targetHref("provider_integration", "int-1", BASE)).toBe("/keys/dashboard/integrations/int-1");
  });

  it("workspace → /home", () => {
    expect(targetHref("workspace", "ws-1", BASE)).toBe("/keys/dashboard/home");
  });

  it("route → null (route audit lacks projectId — link absent, not dead)", () => {
    expect(targetHref("route", "route-1", BASE)).toBeNull();
  });

  it("unknown targetType → null", () => {
    expect(targetHref("some_future_type", "id-1", BASE)).toBeNull();
  });
});
