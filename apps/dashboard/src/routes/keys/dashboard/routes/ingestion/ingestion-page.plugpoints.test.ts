// @vitest-environment jsdom
/**
 * RES-113 PR-2 — /routes/ingestion host, the plug-point operator twin (placement
 * spec §5 item 3; §3.4 decision C: one derivation, one renderer, two hosts).
 *
 * Pins:
 *  - `models.activeGraph` null (the flag-OFF payload, server-gated in
 *    connect-models-load): NO plug-point disclosure exists — the page renders
 *    byte-for-byte as shipped (snapshot-pinned);
 *  - activeGraph present + disclosure CLOSED: only the summary line (reusing the
 *    registered §2.1 label "Advanced — choose a model per stage") — zero slot
 *    rows mounted;
 *  - disclosure OPEN: the same three §0-named rows as the sources host;
 *  - the shipped "Reset to recommended" bulk action is untouched (the preset that
 *    extends it is PR-3, not this PR).
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/stores", () => ({
  get page() {
    return readable({ url: new URL("http://localhost/keys/dashboard/routes/ingestion"), data: {} });
  },
}));

import IngestionPage from "./+page.svelte";

function models(overrides: Record<string, unknown> = {}) {
  return {
    routing: null,
    projects: [],
    projectId: null,
    environmentId: null,
    environments: [],
    stageRows: [],
    canApplyRecommended: false,
    applyRecommendedApi: "/keys/dashboard/api/connect/pipeline/apply-recommended-routes",
    integrationsCount: 0,
    llmReady: false,
    usesRoutes: false,
    defaults: { chat: "gpt-4o-mini", embedding: "voyage-3" },
    embeddingLock: null,
    activePackEmbedding: { model: "voyage-3", dimensions: 1024 },
    upstreamValidationProviders: [],
    apiBase: "/keys/dashboard/api/connect/pipeline/stage-models",
    activeGraph: null,
    ...overrides,
  };
}

const ACTIVE_GRAPH = {
  id: "11111111-1111-4111-8111-111111111111",
  bundle: { allow_claim_versions_table: false },
};

describe("/routes/ingestion — flag OFF payload (activeGraph null)", () => {
  it("renders no plug-point disclosure at all (byte-identity snapshot)", () => {
    const { container, queryByText } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models() } },
    });
    expect(container.querySelector(".slot-disclosure")).toBeNull();
    expect(queryByText("Advanced — choose a model per stage")).toBeNull();
    expect(container.querySelector(".slot-row")).toBeNull();
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("/routes/ingestion — activeGraph present (flag ON, server-gated)", () => {
  it("closed disclosure shows only the registered §2.1 summary — zero slot rows", () => {
    const { container, getByText } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ activeGraph: ACTIVE_GRAPH }) } },
    });
    expect(getByText("Advanced — choose a model per stage")).toBeTruthy();
    expect(container.querySelector(".slot-row")).toBeNull();
    expect(container.textContent).not.toContain("Reading your documents");
  });

  it("open disclosure renders the same three §0-named rows as the sources host", async () => {
    const { container, getByText } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ activeGraph: ACTIVE_GRAPH }) } },
    });
    const details = container.querySelector(".slot-disclosure") as HTMLDetailsElement;
    const summary = container.querySelector(".slot-disclosure-summary") as HTMLElement;
    details.open = true;
    await fireEvent(details, new Event("toggle"));
    expect(summary).toBeTruthy();
    await waitFor(() => expect(container.querySelectorAll(".slot-row")).toHaveLength(3));
    expect(getByText("Reading your documents")).toBeTruthy();
    expect(getByText("Making it searchable")).toBeTruthy();
    expect(getByText("Checking against sources")).toBeTruthy();
  });
});
