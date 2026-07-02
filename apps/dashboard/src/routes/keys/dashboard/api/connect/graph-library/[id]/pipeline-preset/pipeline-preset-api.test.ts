/**
 * RES-113 PR-3 — the deployment-preset persistence endpoint (placement spec §5
 * item 4, decision A).
 *
 * Pins:
 *  - flag OFF (`m1PlugPoints` absent/false): 404 — the API surface does not exist
 *    on the default path (flag-OFF invariant);
 *  - only a known preset id is accepted (unknown → 400);
 *  - a preset rewrites `pipeline_slots` + records `pipeline_preset` through the
 *    existing `updateConnectGraphTargetBundle` shallow-merge (spec §3.1);
 *  - "Fully managed (recommended)" writes an EMPTY slot map ⇒ `pipeline_slots`
 *    cleared (null patch) — the shipped reset semantics, a real default bundle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

const getTarget = vi.fn();
const updateBundle = vi.fn();
vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetById: (...args: unknown[]) => getTarget(...args),
  updateConnectGraphTargetBundle: (...args: unknown[]) => updateBundle(...args),
}));
vi.mock("$lib/server/connect/session-context", () => ({
  resolveKnowledgeSessionContext: vi.fn(async () => ({ userId: "u-1", workspaceId: "ws-1" })),
  isKnowledgeSessionFailure: (v: unknown) =>
    typeof v === "object" && v !== null && "status" in (v as Record<string, unknown>),
}));

import { PUT } from "./+server";

type PutEvent = Parameters<typeof PUT>[0];

function event(body: unknown, flagOn = true): PutEvent {
  return {
    locals: {
      user: { uid: "u-1", authType: "session" },
      moduleFlags: { ...MVP_MODULE_DEFAULTS, m1PlugPoints: flagOn },
    },
    params: { id: "g-1" },
    request: new Request("http://localhost/x", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as unknown as PutEvent;
}

function targetRecord(settings: Record<string, unknown> = {}) {
  return { id: "g-1", workspaceId: "ws-1", settings };
}

beforeEach(() => {
  getTarget.mockReset();
  updateBundle.mockReset();
  updateBundle.mockResolvedValue(undefined);
});

describe("PUT pipeline-preset — gating and validation", () => {
  it("404s when the m1PlugPoints flag is OFF (default path has no API surface)", async () => {
    const res = await PUT(event({ preset: "highest-accuracy" }, false));
    expect(res.status).toBe(404);
    expect(getTarget).not.toHaveBeenCalled();
    expect(updateBundle).not.toHaveBeenCalled();
  });

  it("400s an unknown preset id", async () => {
    getTarget.mockResolvedValue(targetRecord());
    expect((await PUT(event({ preset: "not-a-preset" }))).status).toBe(400);
    expect((await PUT(event({ preset: 3 }))).status).toBe(400);
    expect(updateBundle).not.toHaveBeenCalled();
  });

  it("404s when the graph is not in this workspace", async () => {
    getTarget.mockResolvedValue(null);
    expect((await PUT(event({ preset: "highest-accuracy" }))).status).toBe(404);
  });
});

describe("PUT pipeline-preset — persistence semantics", () => {
  it("a non-default preset writes its slot map + preset marker", async () => {
    getTarget.mockResolvedValue(targetRecord());
    const res = await PUT(event({ preset: "highest-accuracy" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      preset: "highest-accuracy",
      preset_name: "Highest accuracy",
      pipeline_slots: { extract: "mistral-ocr-4", embed: "qwen3-embedding-8b", validate: "frontier-hosted" },
    });
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: {
        pipeline_slots: { extract: "mistral-ocr-4", embed: "qwen3-embedding-8b", validate: "frontier-hosted" },
        pipeline_preset: "highest-accuracy",
      },
    });
  });

  it("'Fully managed (recommended)' clears the slot map (the shipped reset)", async () => {
    getTarget.mockResolvedValue(targetRecord({ pipeline_slots: { extract: "mistral-ocr-4" } }));
    const res = await PUT(event({ preset: "fully-managed" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      preset: "fully-managed",
      preset_name: "Fully managed (recommended)",
      pipeline_slots: {},
    });
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: { pipeline_slots: null, pipeline_preset: "fully-managed" },
    });
  });

  it("a preset that shares some defaults writes only the non-default slots", async () => {
    getTarget.mockResolvedValue(targetRecord());
    // regional-residency = mistral-ocr-4 + bge-m3 (default) + granite-guardian (default).
    const res = await PUT(event({ preset: "regional-residency" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pipeline_slots: { extract: "mistral-ocr-4" } });
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: { pipeline_slots: { extract: "mistral-ocr-4" }, pipeline_preset: "regional-residency" },
    });
  });
});
