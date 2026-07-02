// @vitest-environment jsdom
/**
 * Spec §6 Decision A / copy pack §7 — the Home graph switcher's manage link.
 *
 *  - the link targets the standing graph home (GRAPHS_HREF), NOT SOURCES_HREF
 *    (which dead-ended at the Sources "Advanced" disclosure);
 *  - its visible text is "Connect or switch a graph" (was "Manage library");
 *  - its aria-label CONTAINS the visible text verbatim (WCAG 2.5.3 Label-in-Name).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import { GRAPHS_HREF } from "$lib/nav-config";

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import ConnectGraphSwitcher from "./ConnectGraphSwitcher.svelte";

const GRAPH = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  label: "Main graph",
  is_active: true,
  provider: "surreal" as const,
  connection: { endpoint: "https://surreal.example", namespace: "ns", database: "db" },
  use_dashboard_database: false,
  secret_set: false,
  bundle: {},
  status: "ok" as const,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  // onMount fetches the graph library; return one graph so the switcher renders.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ graphs: [GRAPH] }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConnectGraphSwitcher manage link", () => {
  it("targets the standing graph home (GRAPHS_HREF), not Sources", async () => {
    const { getByText } = render(ConnectGraphSwitcher);
    const link = (await waitFor(() =>
      getByText("Connect or switch a graph"),
    )) as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(GRAPHS_HREF);
    expect(link.getAttribute("href")).toContain("/graphs");
    expect(link.getAttribute("href")).not.toContain("/sources");
  });

  it("relabels the link to 'Connect or switch a graph' (was 'Manage library')", async () => {
    const { getByText, queryByText } = render(ConnectGraphSwitcher);
    await waitFor(() => getByText("Connect or switch a graph"));
    expect(queryByText("Manage library")).toBeNull();
  });

  it("aria-label CONTAINS the visible text verbatim (WCAG 2.5.3 Label-in-Name)", async () => {
    const { getByText } = render(ConnectGraphSwitcher);
    const link = (await waitFor(() =>
      getByText("Connect or switch a graph"),
    )) as HTMLAnchorElement;
    const aria = link.getAttribute("aria-label") ?? "";
    expect(aria).toContain("Connect or switch a graph");
    expect(aria).toBe(
      "Connect or switch a graph — choose the graph this workspace builds into",
    );
  });
});
