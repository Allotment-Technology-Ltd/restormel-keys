/**
 * R2 — redirect contract test, table-driven from the disposition table
 * (docs/design/keys-northstar-redesign-2026-06.md §2.3).
 *
 * Every relocated URL maps old → new with query params preserved
 * (?step, ?filter, ?unit, ?workspace, ?focus, returnTo …). All these routes
 * are served as 308s by thin +page.server.ts loads that call this mapper.
 */
import { describe, it, expect } from "vitest";
import { resolveLegacyDashboardRedirect } from "./legacy-route-redirects";

const B = "/keys/dashboard";

/** [old pathname, query string, expected target] — mirrors §2.3 row by row. */
const REDIRECT_TABLE: [string, string, string][] = [
  // /keys/dashboard (root) → /home — "one home"
  [`${B}`, "", `${B}/home`],
  [`${B}/`, "", `${B}/home`],
  // /activity MERGE-INTO /home
  [`${B}/activity`, "", `${B}/home`],
  [`${B}/activity`, "?monitor-interest=alerts", `${B}/home?monitor-interest=alerts`],
  // /connect (hub Home) MERGE-INTO /home
  [`${B}/connect`, "", `${B}/home`],
  [`${B}/connect/`, "", `${B}/home`],
  // /connect/library MERGE-INTO /sources (Packs view)
  [`${B}/connect/library`, "", `${B}/sources`],
  // /connect/models MOVE → /routes ingestion view
  [`${B}/connect/models`, "", `${B}/routes/ingestion`],
  [`${B}/connect/models`, "?returnTo=pipeline-setup&step=sources", `${B}/routes/ingestion?returnTo=pipeline-setup&step=sources`],
  // /connect/pipeline (+ step redirects) REDESIGN → /sources/ingest; ?step preserved
  [`${B}/connect/pipeline`, "", `${B}/sources/ingest`],
  [`${B}/connect/pipeline`, "?step=store", `${B}/sources/ingest?step=store`],
  // R4 — the new provider step id carries through the ?step redirect like any other.
  [`${B}/connect/pipeline`, "?step=provider", `${B}/sources/ingest?step=provider`],
  [`${B}/connect/pipeline`, "?step=sources", `${B}/sources/ingest?step=sources`],
  [`${B}/connect/pipeline`, "?step=domain", `${B}/sources/ingest?step=domain`],
  [`${B}/connect/pipeline`, "?step=launch&domain_pack_id=p1", `${B}/sources/ingest?step=launch&domain_pack_id=p1`],
  [`${B}/connect/pipeline/domain`, "", `${B}/sources/ingest/domain`],
  [`${B}/connect/pipeline/sources`, "", `${B}/sources/ingest/sources`],
  [`${B}/connect/pipeline/store`, "", `${B}/sources/ingest/store`],
  [`${B}/connect/pipeline/profiles`, "", `${B}/sources/ingest/profiles`],
  [`${B}/connect/pipeline/agents`, "", `${B}/sources/ingest/agents`],
  // /connect/ingest MOVE → /runs
  [`${B}/connect/ingest`, "", `${B}/runs`],
  // /connect/ingest/[jobId] MOVE → /runs/[id]
  [`${B}/connect/ingest/job-123`, "", `${B}/runs/job-123`],
  [`${B}/connect/ingest/job-123`, "?from=pipeline", `${B}/runs/job-123?from=pipeline`],
  [`${B}/connect/ingest/job-9`, "?from=graph&task=revalidate", `${B}/runs/job-9?from=graph&task=revalidate`],
  // /connect/ingest/new KILL (D8) — old behaviour (redirect → wizard launch) preserved for bookmarks
  [`${B}/connect/ingest/new`, "", `${B}/sources/ingest?step=launch`],
  // /connect/graph MOVE → /claims — W2.1 URL contract survives (explicit acceptance criterion)
  [`${B}/connect/graph`, "", `${B}/claims`],
  [`${B}/connect/graph`, "?filter=review", `${B}/claims?filter=review`],
  [`${B}/connect/graph`, "?unit=unit%3A123", `${B}/claims?unit=unit%3A123`],
  [`${B}/connect/graph`, "?workspace=tools&focus=embed", `${B}/claims?workspace=tools&focus=embed`],
  [`${B}/connect/graph`, "?filter=review&unit=u1&workspace=tools&focus=embed", `${B}/claims?filter=review&unit=u1&workspace=tools&focus=embed`],
  // /connect/memory (W2.4) MOVE → /claims/memory
  [`${B}/connect/memory`, "", `${B}/claims/memory`],
  // /connect/proof MOVE → /prove (incl. its page-private api endpoints)
  [`${B}/connect/proof`, "", `${B}/prove`],
  [`${B}/connect/proof/api/delta`, "", `${B}/prove/api/delta`],
  [`${B}/connect/proof/api/stream`, "", `${B}/prove/api/stream`],
  [`${B}/connect/proof/api/suggest`, "", `${B}/prove/api/suggest`],
  // /connect/mcp MOVE → /agents
  [`${B}/connect/mcp`, "", `${B}/agents`],
  // Unknown hub sub-paths land on Home (the hub MERGE-INTO /home)
  [`${B}/connect/unknown-thing`, "", `${B}/home`],
  // /projects/[id]/usage KILL → redirect → /analytics?project=
  [`${B}/projects/p-1/usage`, "", `${B}/analytics?project=p-1`],
];

describe("R2 redirect table (§2.3)", () => {
  it.each(REDIRECT_TABLE)("%s%s → %s", (path, search, expected) => {
    expect(resolveLegacyDashboardRedirect(path, search)).toBe(expected);
  });

  it("returns null for non-relocated paths (no accidental hijack)", () => {
    expect(resolveLegacyDashboardRedirect(`${B}/routes`, "")).toBeNull();
    expect(resolveLegacyDashboardRedirect(`${B}/home`, "")).toBeNull();
    expect(resolveLegacyDashboardRedirect(`${B}/projects/p-1`, "")).toBeNull();
    expect(resolveLegacyDashboardRedirect("/keys/docs", "")).toBeNull();
  });
});

describe("R2 redirect routes serve 308 (permanent)", () => {
  /** Invoke a thin redirect +page.server.ts load and capture the thrown redirect. */
  async function caught(loadModule: Promise<{ load: (e: never) => unknown }>, pathname: string, search = "") {
    const { load } = await loadModule;
    try {
      await load({ url: new URL(`https://keys.test${pathname}${search}`), params: { id: "p-1" } } as never);
    } catch (e) {
      return e as { status: number; location: string };
    }
    throw new Error("expected redirect");
  }

  it("/connect/* catch-all 308s with params preserved", async () => {
    const r = await caught(
      import("../routes/keys/dashboard/connect/[...legacy]/+page.server.js"),
      `${B}/connect/graph`,
      "?filter=review&unit=u1",
    );
    expect(r.status).toBe(308);
    expect(r.location).toBe(`${B}/claims?filter=review&unit=u1`);
  });

  it("/activity 308s to /home", async () => {
    const r = await caught(import("../routes/keys/dashboard/activity/+page.server.js"), `${B}/activity`);
    expect(r.status).toBe(308);
    expect(r.location).toBe(`${B}/home`);
  });

  it("/projects/[id]/usage 308s to scoped analytics", async () => {
    const r = await caught(
      import("../routes/keys/dashboard/projects/[id]/usage/+page.server.js"),
      `${B}/projects/p-1/usage`,
    );
    expect(r.status).toBe(308);
    expect(r.location).toBe(`${B}/analytics?project=p-1`);
  });

  it("dashboard root 308s to /home", async () => {
    const r = await caught(import("../routes/keys/dashboard/+page.server.js"), B);
    expect(r.status).toBe(308);
    expect(r.location).toBe(`${B}/home`);
  });
});
