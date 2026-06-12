// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import VersionsPanel from "./VersionsPanel.svelte";

/**
 * W3.5 (M2) — the publish confirm must describe the blast radius of THIS
 * publish (the pending draft vs the live version), not the previous published
 * change. These tests drive the route mount (diffMode="client" + draftSnapshot)
 * through the history fetch and a publish click, asserting the confirm text.
 */

const HISTORY = "/api/projects/p1/routes/r1/history";
const PUBLISH = "/api/projects/p1/routes/r1/publish";

/** The latest published snapshot the history endpoint returns (live = v2). */
function historyEvents() {
  return [
    {
      id: "e2",
      version: 2,
      action: "publish",
      actorType: "session",
      actorId: "u1",
      summary: "Published route version 2",
      createdAt: Date.now(),
      routeSnapshot: { name: "Chat", status: "active" },
      stepsSnapshot: [{ id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true }],
    },
    {
      id: "e1",
      version: 1,
      action: "publish",
      actorType: "session",
      actorId: "u1",
      summary: "Published route version 1",
      createdAt: Date.now() - 1000,
      routeSnapshot: { name: "Chat", status: "active" },
      stepsSnapshot: [{ id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true }],
    },
  ];
}

function mockHistoryFetch() {
  const fetchMock = vi.fn((url: string) => {
    if (String(url).includes("/history")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: historyEvents() }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { publishedVersion: 3 } }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const baseProps = {
  historyUrl: HISTORY,
  publishUrl: PUBLISH,
  rollbackUrl: "/api/projects/p1/routes/r1/rollback",
  onMutated: () => {},
  entityNoun: "route" as const,
  diffMode: "client" as const,
  currentVersion: 3,
  publishedVersion: 2,
};

describe("VersionsPanel publish confirm — draft vs live (M2)", () => {
  it("describes THIS publish's blast radius from the draft-vs-live diff", async () => {
    mockHistoryFetch();
    const confirmSpy = vi.fn().mockReturnValue(false); // decline so we only inspect the prompt
    vi.stubGlobal("confirm", confirmSpy);

    // Draft differs from the live (v2) snapshot: model swapped to gpt-4o-mini.
    const draftSnapshot = {
      routeSnapshot: { name: "Chat", status: "active" },
      stepsSnapshot: [{ id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o-mini", enabled: true }],
    };

    const { getByRole } = render(VersionsPanel, { props: { ...baseProps, draftSnapshot } });

    // Wait for history to load (the rollback button for v1 appears once ready).
    await waitFor(() => expect(getByRole("button", { name: /Roll back .* version 1/i })).toBeTruthy());

    await fireEvent.click(getByRole("button", { name: /Publish draft/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const prompt = String(confirmSpy.mock.calls[0][0]);
    expect(prompt).toContain("Publishing changes:");
    expect(prompt).toContain("1 step changed");
    expect(prompt).toContain("vs live version 2");
    // It must NOT use the previous-published-change wording.
    expect(prompt).not.toContain("Most recent published change");
  });

  it("says there are no changes vs live when the draft equals the live snapshot", async () => {
    mockHistoryFetch();
    const confirmSpy = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmSpy);

    const draftSnapshot = {
      routeSnapshot: { name: "Chat", status: "active" },
      stepsSnapshot: [{ id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true }],
    };

    const { getByRole } = render(VersionsPanel, { props: { ...baseProps, draftSnapshot } });
    await waitFor(() => expect(getByRole("button", { name: /Roll back .* version 1/i })).toBeTruthy());

    await fireEvent.click(getByRole("button", { name: /Publish draft/i }));
    const prompt = String(confirmSpy.mock.calls[0][0]);
    expect(prompt).toContain("No changes vs live version 2");
    expect(prompt).toContain("re-publishes the same configuration");
  });
});
