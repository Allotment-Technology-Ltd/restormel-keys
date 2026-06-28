// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import ConnectionsManager from "./ConnectionsManager.svelte";
import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";

function setupData(overrides: Partial<ConnectAgentSetupData> = {}): ConnectAgentSetupData {
  return {
    workspaceId: "ws_1",
    projectId: "proj_1",
    surrealStoreReady: true,
    modelsReady: true,
    hasGraph: true,
    agentReady: true,
    graphTargetStatus: "ready",
    connectApiBase: "https://connect.restormel.dev",
    projects: [{ id: "proj_1", name: "Default" }],
    gatewayKeys: [],
    defaultProjectId: "proj_1",
    ...overrides,
  };
}

describe("ConnectionsManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("first run (no connections) leads with the wizard + a what-next cue", () => {
    const { getByText, getByRole } = render(ConnectionsManager, { props: { setup: setupData() } });
    // The wizard is the first-connection surface.
    expect(getByRole("heading", { name: /Connect your app/i })).toBeTruthy();
    // Honest "where am I / what next" cue (consumes the milestone helper).
    expect(getByText(/Create your first connection/i)).toBeTruthy();
  });

  it("lists stored Gateway keys as typed connections with a mocked access badge", () => {
    const { getByText, getAllByText } = render(ConnectionsManager, {
      props: {
        setup: setupData({
          gatewayKeys: [
            { id: "k1", keyPrefix: "rk_live_aa", projectId: "proj_1", projectName: "Default", label: "agent read+write" },
            { id: "k2", keyPrefix: "rk_live_bb", projectId: "proj_1", projectName: "Default", label: "prod backend REST" },
          ],
        }),
      },
    });
    expect(getByText("agent read+write")).toBeTruthy();
    expect(getByText("prod backend REST")).toBeTruthy();
    // Mocked access badges derived from the labels.
    expect(getByText("READ+WRITE")).toBeTruthy();
    expect(getByText("READ")).toBeTruthy();
    // Live cue once there are connections.
    expect(getAllByText(/Live/i).length).toBeGreaterThan(0);
  });

  it("creating a connection mints a key via the existing CRUD and reveals it once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { keyId: "k_new", keyPrefix: "rk_live_zz", rawKey: "rk_live_zz_secret" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, getByText, container } = render(ConnectionsManager, {
      props: { setup: setupData() },
    });

    await fireEvent.click(getByRole("button", { name: /MCP server/i }));
    await fireEvent.click(getByRole("button", { name: /Continue/i }));
    await fireEvent.click(getByRole("button", { name: /Continue/i }));
    const nameInput = container.querySelector("#m4-conn-name") as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: "agent" } });
    await fireEvent.click(getByRole("button", { name: /Create connection/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/projects/proj_1/keys");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ label: "agent" });

    // Key revealed once, plus the MCP snippet for an MCP connection.
    await waitFor(() => expect(getByText("rk_live_zz_secret")).toBeTruthy());
    expect(getByText(/MCP host config/i)).toBeTruthy();
  });

  it("delete calls the CRUD DELETE and drops the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, queryByText } = render(ConnectionsManager, {
      props: {
        setup: setupData({
          gatewayKeys: [
            { id: "k1", keyPrefix: "rk_live_aa", projectId: "proj_1", projectName: "Default", label: "agent" },
          ],
        }),
      },
    });

    expect(queryByText("agent")).toBeTruthy();
    await fireEvent.click(getByRole("button", { name: /Delete connection agent/i }));
    await fireEvent.click(getByRole("button", { name: /Confirm delete/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/projects/proj_1/keys");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ keyId: "k1" });
    await waitFor(() => expect(queryByText("agent")).toBeNull());
  });
});
