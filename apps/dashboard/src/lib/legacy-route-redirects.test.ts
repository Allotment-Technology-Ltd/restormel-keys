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
  // /keys/dashboard (root) → the verified Answer Console (Phase 3 Stage 1 landing)
  [`${B}`, "", `${B}/prove/proof`],
  [`${B}/`, "", `${B}/prove/proof`],
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
  // RES-113 PR-G — journey IA section-aliases (additive; query preserved). `/build`
  // (M1) → the ingest guided flow; `/verify` (M2) → the make-ready / stamping desk.
  [`${B}/build`, "", `${B}/sources/ingest`],
  [`${B}/build`, "?step=sources", `${B}/sources/ingest?step=sources`],
  [`${B}/verify`, "", `${B}/claims`],
  [`${B}/verify`, "?filter=review", `${B}/claims?filter=review`],
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

  it("dashboard root 308s to the Answer Console (Phase 3 Stage 1 landing)", async () => {
    const r = await caught(import("../routes/keys/dashboard/+page.server.js"), B);
    expect(r.status).toBe(308);
    expect(r.location).toBe(`${B}/prove/proof`);
  });
});

/**
 * RES-113 PR-G — flag-gated landing + journey section-alias routes.
 *
 * Proves BOTH flag states at the redirect boundary. With `onboardingJourney` OFF
 * the landing + `/connect` behaviour is byte-for-byte unchanged (the suite above,
 * which passes no locals, already asserts the OFF defaults). ON, the landing leads
 * to the persistent Home and the bare `/connect` consolidates onto the M4 surface,
 * while every existing `/connect/*` sub-redirect is left intact.
 */
describe("RES-113 PR-G — flag-gated landing + journey aliases", () => {
  async function caughtWithLocals(
    loadModule: Promise<{ load: (e: never) => unknown }>,
    pathname: string,
    onboardingJourney: boolean,
    search = "",
  ) {
    const { load } = await loadModule;
    try {
      await load({
        url: new URL(`https://keys.test${pathname}${search}`),
        params: { legacy: pathname.split("/connect/")[1] ?? "" },
        locals: { moduleFlags: { onboardingJourney } },
      } as never);
    } catch (e) {
      return e as { status: number; location: string };
    }
    throw new Error("expected redirect");
  }

  it("dashboard root: ON → /home, OFF → /prove/proof (flag-OFF byte-for-byte)", async () => {
    const on = await caughtWithLocals(import("../routes/keys/dashboard/+page.server.js"), B, true);
    expect(on.status).toBe(308);
    expect(on.location).toBe(`${B}/home`);
    const off = await caughtWithLocals(import("../routes/keys/dashboard/+page.server.js"), B, false);
    expect(off.location).toBe(`${B}/prove/proof`);
  });

  it("dashboard root: ON preserves the query string", async () => {
    const on = await caughtWithLocals(
      import("../routes/keys/dashboard/+page.server.js"),
      B,
      true,
      "?template=mythology",
    );
    expect(on.location).toBe(`${B}/home?template=mythology`);
  });

  it("bare /connect: ON → /agents/wiring, OFF → /home (legacy, unchanged)", async () => {
    const on = await caughtWithLocals(
      import("../routes/keys/dashboard/connect/[...legacy]/+page.server.js"),
      `${B}/connect`,
      true,
    );
    expect(on.status).toBe(308);
    expect(on.location).toBe(`${B}/agents/wiring`);
    const off = await caughtWithLocals(
      import("../routes/keys/dashboard/connect/[...legacy]/+page.server.js"),
      `${B}/connect`,
      false,
    );
    expect(off.location).toBe(`${B}/home`);
  });

  it("/connect/* sub-redirects are NOT hijacked by the journey branch (ON or OFF)", async () => {
    // The bare-path consolidation only fires for exactly /connect — sub-paths keep
    // their legacy 308 targets regardless of the flag.
    const on = await caughtWithLocals(
      import("../routes/keys/dashboard/connect/[...legacy]/+page.server.js"),
      `${B}/connect/graph`,
      true,
      "?filter=review",
    );
    expect(on.location).toBe(`${B}/claims?filter=review`);
  });

  it("/build: ON → 308 to the ingest guided flow, OFF → 404 (route does not exist, fully reversible)", async () => {
    const on = await caughtWithLocals(import("../routes/keys/dashboard/build/+page.server.js"), `${B}/build`, true);
    expect(on.status).toBe(308);
    expect(on.location).toBe(`${B}/sources/ingest`);
    const off = await caughtWithLocals(import("../routes/keys/dashboard/build/+page.server.js"), `${B}/build`, false);
    expect(off.status).toBe(404);
  });

  it("/verify: ON → renders a real page (RES-113 PR-6b, no redirect), OFF → 404 (byte-for-byte unchanged)", async () => {
    // ON: the PR-6b rewrite returns page data instead of throwing a redirect
    // (signed-out locals → the signed-out shell data, no DB touched).
    const { load } = await import("../routes/keys/dashboard/verify/+page.server.js");
    const data = (await (load as (e: never) => unknown)({
      url: new URL(`https://keys.test${B}/verify`),
      params: {},
      locals: { moduleFlags: { onboardingJourney: true } },
    } as never)) as { hubSignedIn: boolean };
    expect(data.hubSignedIn).toBe(false);
    // OFF: the route still does not exist — the pre-PR-6 404, fully reversible.
    const off = await caughtWithLocals(import("../routes/keys/dashboard/verify/+page.server.js"), `${B}/verify`, false);
    expect(off.status).toBe(404);
  });
});

describe("B1 regression — Proof tab proveBase must resolve to live +server.ts routes", () => {
  /**
   * Pins the proveBase value exported by prove/proof/+page.server.ts to
   * DASHBOARD_BASE + "/prove" so that GraphComparisonPanel and comparison-stream.ts
   * hit the real +server.ts endpoints at /prove/api/{stream,delta,suggest}.
   *
   * A future base move that accidentally restores "/prove/proof" would make the
   * panel's API calls 404 (no +server.ts lives under /prove/proof/api/).
   */
  it("proveBase resolves to /keys/dashboard/prove (not /prove/proof)", async () => {
    const { load } = await import("../routes/keys/dashboard/prove/proof/+page.server.js");
    // Trigger the signed-out fast-path (no DB needed) — SIGNED_OUT constant carries proveBase.
    const data = await (load as (e: never) => unknown)({
      locals: {},
      parent: async () => ({}),
      url: new URL("https://keys.test/keys/dashboard/prove/proof"),
      params: {},
    } as never);
    const { proveBase } = data as { proveBase: string };
    // Must point at /prove, NOT /prove/proof — the api/ +server.ts files live at /prove/api/*.
    expect(proveBase).toBe(`${B}/prove`);
    expect(proveBase).not.toContain("/prove/proof");
    // The three endpoints the panel uses must be reachable under proveBase.
    for (const endpoint of ["stream", "delta", "suggest"]) {
      expect(`${proveBase}/api/${endpoint}`).toBe(`${B}/prove/api/${endpoint}`);
    }
  });
});
