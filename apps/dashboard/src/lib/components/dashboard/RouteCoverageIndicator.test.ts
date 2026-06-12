// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import RouteCoverageIndicator from "./RouteCoverageIndicator.svelte";

/**
 * W3.5 (M3) — the route-coverage indicator consumes the existing project
 * `route-coverage` endpoint and renders ux-contracts §3 states. The endpoint's
 * numbers are quoted verbatim; these assertions pin the loading → success,
 * error, and empty transitions plus the "no enabled step" headline.
 */

const URL = "/keys/dashboard/api/projects/p1/route-coverage";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RouteCoverageIndicator", () => {
  it("renders a warning headline with the verbatim zero-enabled-step count and a link to the routes", async () => {
    mockFetchOnce({
      data: {
        routeCount: 3,
        zeroEnabledStepRoutes: 2,
        environments: [
          {
            environmentId: "env1",
            coveredCells: 1,
            totalCells: 2,
            coveragePct: 50,
            cells: [
              { workload: "ingestion", stage: "normalize", routeCount: 1, enabledStepCount: 1, hasEnabledRoute: true },
              { workload: "ingestion", stage: "extract", routeCount: 1, enabledStepCount: 0, hasEnabledRoute: false },
            ],
          },
        ],
      },
    });

    const { findByText, getByRole } = render(RouteCoverageIndicator, {
      props: { coverageUrl: URL, routesHref: "#list-heading" },
    });

    const headline = await findByText(/2 of 3/);
    expect(headline.textContent).toContain("no enabled step");
    // X4: the indicator links to what it summarizes.
    const link = getByRole("link", { name: /review them below/i });
    expect(link.getAttribute("href")).toBe("#list-heading");
  });

  it("renders the healthy headline when every route has an enabled step", async () => {
    mockFetchOnce({
      data: { routeCount: 2, zeroEnabledStepRoutes: 0, environments: [] },
    });
    const { findByText } = render(RouteCoverageIndicator, {
      props: { coverageUrl: URL, routesHref: "#list-heading" },
    });
    expect(await findByText(/All 2 routes have at least one enabled step/)).toBeTruthy();
  });

  it("renders the empty state when the project has no routes", async () => {
    mockFetchOnce({ data: { routeCount: 0, zeroEnabledStepRoutes: 0, environments: [] } });
    const { findByText } = render(RouteCoverageIndicator, {
      props: { coverageUrl: URL, routesHref: "#list-heading" },
    });
    expect(await findByText(/No routes yet/i)).toBeTruthy();
  });

  it("renders an error banner with a retry when the endpoint fails", async () => {
    mockFetchOnce({ error: "route_coverage_failed" }, false, 500);
    const { findByText, getByRole } = render(RouteCoverageIndicator, {
      props: { coverageUrl: URL, routesHref: "#list-heading" },
    });
    expect(await findByText(/Could not load route coverage/i)).toBeTruthy();
    expect(getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("shows the verbatim coverage percentage in the workload × stage matrix", async () => {
    mockFetchOnce({
      data: {
        routeCount: 1,
        zeroEnabledStepRoutes: 0,
        environments: [
          {
            environmentId: "env1",
            coveredCells: 1,
            totalCells: 1,
            coveragePct: 100,
            cells: [
              { workload: "serving", stage: "live", routeCount: 1, enabledStepCount: 2, hasEnabledRoute: true },
            ],
          },
        ],
      },
    });
    const { findByText, getByRole, getByText } = render(RouteCoverageIndicator, {
      props: { coverageUrl: URL, routesHref: "#list-heading", environmentName: () => "Production" },
    });
    await findByText(/All 1 route has at least one enabled step/);
    // Toggle the matrix open.
    getByRole("button", { name: /workload .* stage coverage/i }).click();
    await waitFor(() => expect(getByText(/Production/)).toBeTruthy());
    expect(getByText(/1\/1 cells \(100%\)/)).toBeTruthy();
  });
});
