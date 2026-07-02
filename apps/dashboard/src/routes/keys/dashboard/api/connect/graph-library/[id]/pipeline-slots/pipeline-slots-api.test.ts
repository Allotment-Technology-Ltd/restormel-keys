/**
 * RES-113 PR-2 — the pipeline-slots persistence endpoint.
 *
 * Pins:
 *  - flag OFF (`m1PlugPoints` absent/false): 404 — the API surface does not
 *    exist on the default path (flag-OFF invariant);
 *  - only ids the derivation OFFERS are accepted (unknown ids and unknown slots
 *    are 400) — BLOCKED/AMBIGUOUS components are unreachable by construction;
 *  - a non-default choice shallow-merges `pipeline_slots` into settings via the
 *    existing `updateConnectGraphTargetBundle` (spec §3.1: settings key, no
 *    schema column);
 *  - choosing the recommended default REMOVES the key; a fully-default map is
 *    removed entirely (null patch) so "default bundle" stays a real absent state.
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

describe("PUT pipeline-slots — gating and validation", () => {
  it("404s when the m1PlugPoints flag is OFF (default path has no API surface)", async () => {
    const res = await PUT(event({ slot: "extract", option_id: "mistral-ocr-4" }, false));
    expect(res.status).toBe(404);
    expect(getTarget).not.toHaveBeenCalled();
    expect(updateBundle).not.toHaveBeenCalled();
  });

  it("400s an unknown slot and an unknown/not-offered option id", async () => {
    getTarget.mockResolvedValue(targetRecord());
    expect((await PUT(event({ slot: "store", option_id: "x" }))).status).toBe(400);
    expect((await PUT(event({ slot: "extract", option_id: "not-a-real-option" }))).status).toBe(400);
    expect(updateBundle).not.toHaveBeenCalled();
  });

  it("404s when the graph is not in this workspace", async () => {
    getTarget.mockResolvedValue(null);
    const res = await PUT(event({ slot: "extract", option_id: "mistral-ocr-4" }));
    expect(res.status).toBe(404);
  });
});

describe("PUT pipeline-slots — persistence semantics", () => {
  it("persists a non-default choice through the settings shallow-merge", async () => {
    getTarget.mockResolvedValue(targetRecord());
    const res = await PUT(event({ slot: "extract", option_id: "mistral-ocr-4" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pipeline_slots: { extract: "mistral-ocr-4" } });
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: { pipeline_slots: { extract: "mistral-ocr-4" } },
    });
  });

  it("keeps other slots' choices while changing one", async () => {
    getTarget.mockResolvedValue(targetRecord({ pipeline_slots: { embed: "qwen3-embedding-8b" } }));
    const res = await PUT(event({ slot: "validate", option_id: "hhem-2.1-open" }));
    expect(res.status).toBe(200);
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: {
        pipeline_slots: { embed: "qwen3-embedding-8b", validate: "hhem-2.1-open" },
      },
    });
  });

  it("choosing the recommended default removes the key; an all-default map is removed", async () => {
    getTarget.mockResolvedValue(targetRecord({ pipeline_slots: { extract: "mistral-ocr-4" } }));
    const res = await PUT(event({ slot: "extract", option_id: "paddleocr-vl" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pipeline_slots: {} });
    expect(updateBundle).toHaveBeenCalledWith({
      graphTargetId: "g-1",
      workspaceId: "ws-1",
      settingsPatch: { pipeline_slots: null },
    });
  });
});
