// @vitest-environment jsdom
/**
 * ux-projects-crud (dashboard-ux-spec §3, §8 Track B B3): the projects/[id] page is the simple
 * CRUD surface by default. The dev/prod environment UI is gated on the `environments` module flag
 * (key restormel-module-environments; MVP default OFF), matching ProjectContextSwitcher and the
 * CI snippet's `includeEnvironmentId`.
 *
 * Pins:
 *  - flag-OFF (default): NO "Environments" heading, NO #ci-env-select, NO
 *    RESTORMEL_ENVIRONMENT_ID_STAGING row — but rename/delete/keys + the other CI rows survive.
 *  - flag-ON: all three environment surfaces render.
 *  - rename / delete / create-key issue the same fetch URLs + methods (non-destructive: unchanged).
 *
 * The load is non-destructive by construction — the flag only gates rendering; environments still
 * load server-side (asserted separately in the +page.server load, untouched here).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

// Mutable page-store data so each test can flip the environments flag before render.
// `var` (not `let`) avoids the TDZ trap: the hoisted vi.mock factory runs when +page.svelte
// is imported, which is before this line's initializer would run under `let`.
var mockPageData: Record<string, unknown> = {};

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/stores", () => ({
  get page() {
    return readable({ url: new URL("http://localhost/keys/dashboard/projects/p1"), data: mockPageData });
  },
}));

import ProjectPage from "./+page.svelte";

function props(over: Record<string, unknown> = {}) {
  return {
    data: {
      project: { id: "proj-1", name: "Demo project" },
      keys: [{ id: "k1", keyPrefix: "rk_live_ab" }],
      environments: [
        { id: "env-dev", name: "Development", type: "development" },
        { id: "env-prod", name: "Production", type: "production" },
      ],
      keysBaseUrl: "https://keys.example",
      error: null,
      ...over,
    },
  };
}

function setFlag(environments: boolean) {
  mockPageData = { moduleFlags: { ...MVP_MODULE_DEFAULTS, environments } };
}

beforeEach(() => {
  // ProjectReadinessCard fetches on mount; give it a benign non-ok response so nothing throws.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as unknown as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("projects/[id] — environments flag OFF (default)", () => {
  it("hides the Environments section, CI env select, and RESTORMEL_ENVIRONMENT_ID row", () => {
    setFlag(false);
    const { queryByRole, queryByText, container } = render(ProjectPage, props());
    expect(queryByRole("heading", { name: "Environments" })).toBeNull();
    expect(container.querySelector("#ci-env-select")).toBeNull();
    expect(queryByText("RESTORMEL_ENVIRONMENT_ID_STAGING")).toBeNull();
  });

  it("keeps the CRUD surface: rename input, delete button, and the non-env CI secret rows", () => {
    setFlag(false);
    const { getByRole, getByLabelText, getByText } = render(ProjectPage, props());
    expect(getByLabelText("Project name")).toBeTruthy();
    expect(getByRole("button", { name: "Delete project" })).toBeTruthy();
    expect(getByText("RESTORMEL_PROJECT_ID_STAGING")).toBeTruthy();
    expect(getByText("RESTORMEL_GATEWAY_KEY_STAGING")).toBeTruthy();
    expect(getByText("RESTORMEL_KEYS_BASE_STAGING")).toBeTruthy();
    expect(getByText("RESTORMEL_EVALUATE_URL_STAGING")).toBeTruthy();
    expect(getByText("RESTORMEL_CONTROL_PLANE_URL_STAGING")).toBeTruthy();
  });
});

describe("projects/[id] — environments flag ON", () => {
  it("renders the Environments section, CI env select, and RESTORMEL_ENVIRONMENT_ID row", () => {
    setFlag(true);
    const { getByRole, getByText, container } = render(ProjectPage, props());
    expect(getByRole("heading", { name: "Environments" })).toBeTruthy();
    expect(container.querySelector("#ci-env-select")).not.toBeNull();
    expect(getByText("RESTORMEL_ENVIRONMENT_ID_STAGING")).toBeTruthy();
  });
});

describe("projects/[id] — CRUD fetch calls unchanged (non-destructive)", () => {
  it("rename issues PATCH /api/projects/:id", async () => {
    setFlag(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    // Re-stub AFTER mount so the readiness call isn't counted, then act.
    const { getByRole } = render(ProjectPage, props());
    vi.stubGlobal("fetch", fetchMock);
    await fireEvent.click(getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DASHBOARD_BASE}/api/projects/proj-1`);
    expect(init?.method).toBe("PATCH");
  });

  it("create-gateway-key issues POST /api/projects/:id/keys", async () => {
    setFlag(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) });
    const { getByRole } = render(ProjectPage, props());
    vi.stubGlobal("fetch", fetchMock);
    await fireEvent.click(getByRole("button", { name: "Create Gateway key for this project" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DASHBOARD_BASE}/api/projects/proj-1/keys`);
    expect(init?.method).toBe("POST");
  });
});
