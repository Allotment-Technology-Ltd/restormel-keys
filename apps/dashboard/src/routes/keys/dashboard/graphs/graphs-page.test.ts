// @vitest-environment jsdom
/**
 * Spec §2/§6 Decision A Option 2 — the standing graph home route.
 *
 * The whole point of the route is "capability never lost": ConnectGraphLibrary —
 * the full connect / switch / edit / delete CRUD — mounts in EVERY signed-in state
 * (empty, loaded, loadFailed→retry) and is NEVER gated on a module flag or
 * m1PlugPoints (contrast the old Sources "Advanced" disclosure). Signed-out shows
 * the sign-in door; the capability is one sign-in away, never behind Advanced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

let pageData: Record<string, unknown> = {};
vi.mock("$app/stores", () => ({
  get page() {
    return readable({ data: pageData, url: new URL("http://localhost/keys/dashboard/graphs") });
  },
}));

import GraphsPage from "./+page.svelte";

function graph(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    label: "Main graph",
    is_active: false,
    provider: "surreal" as const,
    connection: { endpoint: "https://surreal.example", namespace: "ns", database: "db" },
    use_dashboard_database: false,
    secret_set: false,
    bundle: {},
    status: "ok" as const,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function panels(over: Record<string, unknown> = {}) {
  return Promise.resolve({ graphs: [], packs: [], loadFailed: false, ...over });
}

beforeEach(() => {
  pageData = {};
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ graphs: [] }) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("graph home route — capability present in every state", () => {
  it("signed-out: shows the sign-in door (capability one sign-in away, not behind Advanced)", async () => {
    const { getByText } = render(GraphsPage, {
      props: { data: { signedIn: false, panels: panels() } },
    });
    expect(getByText("Sign in to connect or switch a graph.")).toBeTruthy();
  });

  it("empty: mounts the full library (never flag/plugpoint-gated)", async () => {
    // No moduleFlags in pageData — proves the route does NOT gate on any flag.
    const { getByText, getAllByText } = render(GraphsPage, {
      props: { data: { signedIn: true, panels: panels({ graphs: [] }) } },
    });
    await waitFor(() => expect(getByText("Graph Library")).toBeTruthy());
    // The empty state invites the first connect (header + empty-state "+ Add graph").
    expect(getAllByText("+ Add graph").length).toBeGreaterThanOrEqual(1);
    expect(getByText("No graphs saved yet")).toBeTruthy();
  });

  it("loaded: renders full CRUD — Add / Activate / Test / Edit / Delete", async () => {
    const graphs = [graph({ is_active: true, label: "Prod graph" }), graph({ id: "b", label: "Staging graph" })];
    const { getByText, getAllByText } = render(GraphsPage, {
      props: { data: { signedIn: true, panels: panels({ graphs }) } },
    });
    await waitFor(() => expect(getByText("Graph Library")).toBeTruthy());
    expect(getByText("+ Add graph")).toBeTruthy();
    // Activate shows for the inactive graph.
    expect(getByText("Activate")).toBeTruthy();
    // Per-row actions present.
    expect(getAllByText("Test").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Edit").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Delete").length).toBeGreaterThanOrEqual(1);
  });

  it("loadFailed: shows an error + retry, distinct from an empty library", async () => {
    const { getByText, queryByText } = render(GraphsPage, {
      props: { data: { signedIn: true, panels: panels({ loadFailed: true }) } },
    });
    await waitFor(() => expect(getByText("Couldn't load your graphs")).toBeTruthy());
    expect(getByText("Try again")).toBeTruthy();
    // Not misreported as "no graphs".
    expect(queryByText("No graphs saved yet")).toBeNull();
  });

  it("retry after a load failure re-runs the loader (invalidateAll)", async () => {
    const { invalidateAll } = await import("$app/navigation");
    const { getByText } = render(GraphsPage, {
      props: { data: { signedIn: true, panels: panels({ loadFailed: true }) } },
    });
    await waitFor(() => expect(getByText("Try again")).toBeTruthy());
    await fireEvent.click(getByText("Try again"));
    expect(invalidateAll).toHaveBeenCalled();
  });
});
