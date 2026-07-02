// @vitest-environment jsdom
/**
 * ingestion-regroup (spec §5, §8 Track B B1+B2+B5) — /routes/ingestion host.
 *
 * Pins the cause→effect regroup:
 *  - B1 PRESET LEADS: the "Where your pipeline runs" preset-card precedes
 *    #routes-heading in DOM order, and stays gated on `activeGraph` ONLY (not
 *    re-gated on projectId/environmentId);
 *  - B2 ENV-FREE BINDING: no Environment <select>; route-create and
 *    apply-recommended send NO client-chosen environment (the loader-resolved
 *    default is used / the server resolves it), so requests carry no
 *    environment_id the client picked;
 *  - copy-token fix §10a: the preset-card adds no unregistered heading/sub —
 *    the component owns the registered "Where your pipeline runs" copy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

const ACTIVE_GRAPH = {
  id: "11111111-1111-4111-8111-111111111111",
  bundle: { allow_claim_versions_table: false },
};

function models(overrides: Record<string, unknown> = {}) {
  return {
    routing: null,
    projects: [{ id: "p-1", name: "Prod project" }],
    projectId: "p-1",
    environmentId: "e-1",
    environments: [{ id: "e-1", name: "Production" }],
    stageRows: [],
    canApplyRecommended: false,
    applyRecommendedApi: "/keys/dashboard/api/connect/pipeline/apply-recommended-routes",
    integrationsCount: 1,
    llmReady: true,
    usesRoutes: true,
    defaults: { chat: "gpt-4o-mini", embedding: "voyage-3" },
    embeddingLock: null,
    activePackEmbedding: { model: "voyage-3", dimensions: 1024 },
    upstreamValidationProviders: [],
    apiBase: "/keys/dashboard/api/connect/pipeline/stage-models",
    activeGraph: null,
    ...overrides,
  };
}

function stageRow(overrides: Record<string, unknown> = {}) {
  return {
    key: "extraction",
    label: "Reading your documents",
    help: "Extraction stage",
    ingestionStage: "extraction",
    route: null,
    visualHref: null,
    activeModel: null,
    recommended: {
      modelId: "claude-3-5-sonnet",
      provider: "anthropic",
      rationale: "Strong extraction quality.",
      sameProviderFallback: false,
    },
    ...overrides,
  };
}

describe("B1 PRESET LEADS", () => {
  it("preset-card precedes #routes-heading in DOM order", () => {
    const { container } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ activeGraph: ACTIVE_GRAPH }) } },
    });
    const preset = container.querySelector(".preset-card");
    const routesHeading = container.querySelector("#routes-heading");
    expect(preset).toBeTruthy();
    expect(routesHeading).toBeTruthy();
    // preset comes BEFORE routes heading in document order.
    expect(
      preset!.compareDocumentPosition(routesHeading!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("preset stays gated on activeGraph ONLY — renders with projectId null (not re-gated)", () => {
    const { container, getByText } = render(IngestionPage, {
      props: {
        data: { signedIn: true, models: models({ activeGraph: ACTIVE_GRAPH, projectId: null, environmentId: null }) },
      },
    });
    // preset renders even though projectId is null …
    expect(getByText("Where your pipeline runs")).toBeTruthy();
    expect(container.querySelector(".preset-card")).toBeTruthy();
    // … while the projectId-gated routes card does NOT.
    expect(container.querySelector("#routes-heading")).toBeNull();
  });

  it("preset-card owns the copy — no unregistered heading/sub (copy-token fix §10a)", () => {
    const { container } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ activeGraph: ACTIVE_GRAPH }) } },
    });
    const preset = container.querySelector(".preset-card") as HTMLElement;
    expect(preset.querySelector("h2, h3")).toBeNull();
    // the unregistered sub the copy pack flagged must NOT appear.
    expect(preset.textContent).not.toContain("This deployment shapes every stage route below.");
    expect(preset.getAttribute("aria-label")).toBe("Deployment preset");
  });

  it("preset gate is unchanged when activeGraph is null (byte-identical path — no preset)", () => {
    const { container, queryByText } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ activeGraph: null }) } },
    });
    expect(container.querySelector(".preset-card")).toBeNull();
    expect(queryByText("Where your pipeline runs")).toBeNull();
  });
});

describe("B2 ENV-FREE BINDING", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders no Environment select", () => {
    const { container, queryByText } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models() } },
    });
    expect(queryByText("Environment")).toBeNull();
    // one project select only.
    expect(container.querySelectorAll("select.input")).toHaveLength(1);
  });

  it("route-create sends the loader-resolved environmentId (no client-chosen env)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole } = render(IngestionPage, {
      props: {
        data: {
          signedIn: true,
          models: models({ stageRows: [stageRow()] }),
        },
      },
    });
    await fireEvent.click(getByRole("button", { name: "Create route" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/projects/p-1/routes");
    const body = JSON.parse((init as RequestInit).body as string);
    // the POST still carries an environmentId (endpoint hard-requires it for FK),
    // resolved from the loader default — NOT from any client select.
    expect(body.environmentId).toBe("e-1");
    expect(body.workload).toBe("ingestion");
  });

  it("apply-recommended sends project only — NO environment_id in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole } = render(IngestionPage, {
      props: {
        data: {
          signedIn: true,
          // activeGraph null so the shipped "Reset to recommended" button is present.
          models: models({ canApplyRecommended: true, activeGraph: null }),
        },
      },
    });
    await fireEvent.click(getByRole("button", { name: "Reset to recommended" }));
    await fireEvent.click(getByRole("button", { name: "Confirm — reset to recommended" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("apply-recommended-routes");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.project_id).toBe("p-1");
    expect(body).not.toHaveProperty("environment_id");
  });

  it("routes card gate collapsed to projectId — renders with projectId set", () => {
    const { container } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models() } },
    });
    expect(container.querySelector("#routes-heading")).toBeTruthy();
  });
});

describe("B5 STAGE-ROUTES DEMOTE", () => {
  it("a configured stage demotes 'View recommendation' to a builder link", () => {
    const row = stageRow({
      route: { id: "r-1", name: "Knowledge extraction", status: "active", isPublished: true, enabled: true },
      visualHref: "/keys/dashboard/projects/p-1/routes/r-1?flow=visual",
    });
    const { container } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ stageRows: [row], usesRoutes: true }) } },
    });
    const link = container.querySelector("a.stage-rec-link") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent?.trim()).toBe("View recommendation");
    expect(link.getAttribute("href")).toContain("/routes/r-1?flow=visual");
    // no inline disclosure competes for weight on a configured row.
    expect(container.querySelector(".stage-rec-details")).toBeNull();
  });

  it("an un-created stage keeps the inline recommendation disclosure", () => {
    const { container } = render(IngestionPage, {
      props: { data: { signedIn: true, models: models({ stageRows: [stageRow()] }) } },
    });
    expect(container.querySelector(".stage-rec-details")).toBeTruthy();
    expect(container.querySelector("a.stage-rec-link")).toBeNull();
  });
});
