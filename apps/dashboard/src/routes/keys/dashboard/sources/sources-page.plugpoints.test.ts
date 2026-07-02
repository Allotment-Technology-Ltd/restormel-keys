// @vitest-environment jsdom
/**
 * RES-113 PR-2 — sources-page host for the plug-point slot rows (placement spec
 * §5 item 3; §3.1). Pins the reveal predicate and the flag-OFF invariant:
 *
 *  - flag OFF (`m1PlugPoints` default): the "Advanced" disclosure renders
 *    byte-for-byte as shipped — SNAPSHOT-pinned, open, with an active graph in
 *    the fixture — and no slot-row DOM exists anywhere;
 *  - flag ON + disclosure CLOSED: zero slot pixels (the rows are unmounted);
 *  - flag ON + disclosure OPEN + active graph: the three §0-named rows render
 *    inside the disclosure body, beside the graph-home repoint link (spec §6
 *    Decision A lifted ConnectGraphLibrary out of Advanced to the standing route);
 *  - flag ON + open + NO active graph: rows absent, never disabled-and-teasing
 *    (ux-craft §2.4).
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

let pageData: Record<string, unknown> = {};
vi.mock("$app/stores", () => ({
  get page() {
    return readable({ data: pageData });
  },
}));

import SourcesPage from "./+page.svelte";

const EMPTY_HEALTH = {
  cards: [],
  exceptions: [],
  totals: { indexed: 0, failed: 0, pending: 0, exceptions: 0 },
  lastSyncedAt: null,
};

function activeGraph(bundle: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    label: "Main graph",
    is_active: true,
    provider: "surreal" as const,
    connection: { endpoint: "https://surreal.example", namespace: "ns", database: "db" },
    use_dashboard_database: false,
    secret_set: false,
    bundle: { allow_claim_versions_table: false, ...bundle },
    status: "ok" as const,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function panels(overrides: Record<string, unknown> = {}) {
  return Promise.resolve({
    graphs: [activeGraph()],
    packs: [],
    documents: [
      {
        id: "d1",
        name: "handbook.pdf",
        source_kind: "upload",
        status: "parsed",
        char_count: 100,
        chunk_count: 2,
      },
    ],
    health: EMPTY_HEALTH,
    selectedPackId: null,
    loadFailed: false,
    ...overrides,
  });
}

function setFlags(overrides: Partial<typeof MVP_MODULE_DEFAULTS> = {}) {
  pageData = { moduleFlags: { ...MVP_MODULE_DEFAULTS, ...overrides } };
}

async function renderPage(data: Record<string, unknown>) {
  const out = render(SourcesPage, { props: { data: { signedIn: true, panels: panels(), ...data } } });
  await waitFor(() => expect(out.container.querySelector(".advanced")).not.toBeNull());
  return out;
}

describe("sources page — flag OFF (byte-identity)", () => {
  it("open disclosure matches the shipped snapshot; no slot-row DOM anywhere", async () => {
    setFlags(); // m1PlugPoints: false (MVP default)
    const { container } = await renderPage({});
    await fireEvent.click(container.querySelector(".advanced-toggle") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".advanced-body")).not.toBeNull());
    expect(container.querySelector(".slot-row")).toBeNull();
    expect(container.textContent).not.toContain("Change the model");
    // Pixel-identity pin: the whole Advanced section, open, with an active graph.
    expect((container.querySelector(".advanced") as HTMLElement).outerHTML).toMatchSnapshot();
  });
});

describe("sources page — flag ON (reveal predicate: disclosure open)", () => {
  it("disclosure CLOSED renders zero slot pixels", async () => {
    setFlags({ m1PlugPoints: true });
    const { container } = await renderPage({});
    expect(container.querySelector(".advanced-body")).toBeNull();
    expect(container.querySelector(".slot-row")).toBeNull();
  });

  it("disclosure OPEN renders the three §0-named rows beside the graph-home repoint", async () => {
    setFlags({ m1PlugPoints: true });
    const { container, getByText } = await renderPage({});
    await fireEvent.click(container.querySelector(".advanced-toggle") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelectorAll(".slot-row")).toHaveLength(3));
    expect(getByText("Reading your documents")).toBeTruthy();
    expect(getByText("Making it searchable")).toBeTruthy();
    expect(getByText("Checking against sources")).toBeTruthy();
    // Spec §6 Decision A — the graph library is LIFTED OUT of Advanced. It no longer
    // renders here; the disclosure repoints to the standing graph home instead, so
    // the per-stage slot rows sit beside the repoint link (not the embedded library).
    const repoint = getByText("Manage graphs & data store →") as HTMLAnchorElement;
    expect(repoint).toBeTruthy();
    expect(repoint.getAttribute("href")).toContain("/graphs");
    expect(container.textContent).not.toContain("Graph Library");
  });

  it("no active graph ⇒ rows absent (never disabled-and-teasing)", async () => {
    setFlags({ m1PlugPoints: true });
    const { container } = await renderPage({ panels: panels({ graphs: [] }) });
    await fireEvent.click(container.querySelector(".advanced-toggle") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".advanced-body")).not.toBeNull());
    expect(container.querySelector(".slot-row")).toBeNull();
    expect(container.textContent).not.toContain("Change the model");
  });
});
