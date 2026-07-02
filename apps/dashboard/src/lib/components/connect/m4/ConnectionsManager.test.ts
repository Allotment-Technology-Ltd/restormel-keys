// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import ConnectionsManager from "./ConnectionsManager.svelte";
import type { ConnectAgentSetupData } from "$lib/connect/agent-setup-types";

/**
 * The state-derived Connect surface (RES-113 PR-7; REC-ADR-018 addendum
 * 2026-07-01; copy pack §4). ux-contracts §3 states under test: locked (S0),
 * empty/first-run (S1), success (display-once key), populated list (S2).
 */
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

const KEY = {
  id: "k1",
  keyPrefix: "rk_live_aa",
  projectId: "proj_1",
  projectName: "Default",
  label: "agent",
  keyType: "mcp" as const,
  access: "read" as const,
};

describe("ConnectionsManager — S0 locked (no built graph)", () => {
  it("renders the copy pack §4.1 locked state and NOTHING else", () => {
    const { getByRole, getByText, queryByText, queryByRole } = render(ConnectionsManager, {
      props: { setup: setupData({ hasGraph: false }), enforceScope: true },
    });
    expect(getByRole("heading", { name: "Nothing to connect yet" })).toBeTruthy();
    expect(getByText(/Connect is where your app or AI agent gets access to your answers/i)).toBeTruthy();
    const cta = getByRole("link", { name: /Add your documents/i }) as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toContain("/build");
    // Nothing else renders — no fork, no manager, no create affordance.
    expect(queryByText("What do you want to connect?")).toBeNull();
    expect(queryByRole("button", { name: /Create connection/i })).toBeNull();
    expect(queryByRole("button", { name: /Add connection/i })).toBeNull();
  });

  it("S0 wins even when stray keys exist (nothing to connect TO)", () => {
    const { getByRole, queryByText } = render(ConnectionsManager, {
      props: { setup: setupData({ hasGraph: false, gatewayKeys: [KEY] }), enforceScope: true },
    });
    expect(getByRole("heading", { name: "Nothing to connect yet" })).toBeTruthy();
    expect(queryByText("agent")).toBeNull();
  });
});

describe("ConnectionsManager — S1 guided fork (built, zero connections)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the StateChip cue bar and leads with the fork", () => {
    const { getByText, getByRole } = render(ConnectionsManager, {
      props: { setup: setupData(), enforceScope: true },
    });
    expect(getByText(/Create your first connection to let your app reach your graph/i)).toBeTruthy();
    expect(getByRole("heading", { name: "What do you want to connect?" })).toBeTruthy();
    // No access step, no step strip (wizard collapse).
    expect(() => getByText(/What can this connection do/i)).toThrow();
  });

  it("mints a purpose-bound key (type + access + target) and shows the display-once success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { keyId: "k_new", keyPrefix: "rk_live_zz", rawKey: "rk_live_zz_secret" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, getByText } = render(ConnectionsManager, {
      props: { setup: setupData(), enforceScope: true },
    });

    await fireEvent.click(getByRole("button", { name: /Connect an agent/i }));
    await fireEvent.click(getByRole("button", { name: /Create connection/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/projects/proj_1/keys");
    expect(init.method).toBe("POST");
    // THE KEY IS THE CONNECTION (addendum §4): purpose-bound mint; first key read-only (§2).
    expect(JSON.parse(init.body as string)).toEqual({
      label: "agent",
      keyType: "mcp",
      access: "read",
      target: "ws_1",
    });

    // Success screen (copy pack §4.3): display-once key + endpoint + one CTA to Home's ask.
    await waitFor(() => expect(getByRole("heading", { name: "Connection created" })).toBeTruthy());
    expect(getByText("rk_live_zz_secret")).toBeTruthy();
    expect(
      getByText("This is the only time the full key is shown. Copy it now and store it somewhere safe."),
    ).toBeTruthy();
    expect(getByText("Paste the endpoint and key into your agent's MCP settings.")).toBeTruthy();
    const cta = getByRole("link", { name: /Ask a question/i }) as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toContain("/home");
    // Focus relocated to the success heading ({#if} swap — a11y contract).
    expect(document.activeElement?.id).toBe("m4-success-heading");
  });

  it("mints a legacy flat key when scope is not enforced", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { keyId: "k_new", keyPrefix: "rk_live_zz", rawKey: "rk_live_zz_secret" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole } = render(ConnectionsManager, {
      props: { setup: setupData(), enforceScope: false },
    });
    await fireEvent.click(getByRole("button", { name: /Connect your own code/i }));
    await fireEvent.click(getByRole("button", { name: /Create connection/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ label: "backend" });
  });

  it("keeps the fork with an inline alert when create fails (input preserved)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole } = render(ConnectionsManager, {
      props: { setup: setupData(), enforceScope: true },
    });
    await fireEvent.click(getByRole("button", { name: /Connect an agent/i }));
    await fireEvent.click(getByRole("button", { name: /Create connection/i }));
    await waitFor(() =>
      expect(getByRole("alert").textContent).toMatch(/We couldn't create the connection/i),
    );
    expect(getByRole("heading", { name: "What do you want to connect?" })).toBeTruthy();
  });
});

describe("ConnectionsManager — S2 manager (list-plus-nudge)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists stored keys with real enforced badges; delete lives behind Details, not inline", () => {
    const { getByText, getByRole, queryByRole } = render(ConnectionsManager, {
      props: {
        setup: setupData({
          gatewayKeys: [
            KEY,
            { ...KEY, id: "k2", keyPrefix: "rk_live_bb", label: "backend", keyType: "rest", access: "read_write" },
          ],
        }),
        enforceScope: true,
      },
    });
    expect(getByText("agent")).toBeTruthy();
    expect(getByText("backend")).toBeTruthy();
    expect(getByText("READ")).toBeTruthy();
    expect(getByText("READ + WRITE")).toBeTruthy();
    // No inline delete in the list.
    expect(queryByRole("button", { name: /^Delete/i })).toBeNull();
    // No wizard/fork mounted in the steady state.
    expect(queryByRole("heading", { name: "What do you want to connect?" })).toBeNull();
    expect(getByRole("button", { name: "+ Add connection" })).toBeTruthy();
  });

  it("LIVE renders ONLY for keys with real observed traffic (REC-ADR-016 honesty fix)", async () => {
    const { findByLabelText, queryAllByText } = render(ConnectionsManager, {
      props: {
        setup: setupData({
          gatewayKeys: [KEY, { ...KEY, id: "k2", keyPrefix: "rk_live_bb", label: "backend" }],
        }),
        enforceScope: true,
        liveKeyIds: Promise.resolve(["k2"]),
      },
    });
    const chip = await findByLabelText("This connection has served requests recently");
    expect(chip).toBeTruthy();
    // Exactly one LIVE chip — k1 has no traffic evidence, so NOTHING renders for it.
    expect(queryAllByText("LIVE").length).toBe(1);
  });

  it("renders no LIVE chip at all without traffic evidence", () => {
    const { queryByText } = render(ConnectionsManager, {
      props: {
        setup: setupData({ gatewayKeys: [KEY] }),
        enforceScope: true,
        liveKeyIds: Promise.resolve([]),
      },
    });
    expect(queryByText("LIVE")).toBeNull();
  });

  it("shows the read+write suggestion ONLY when exactly one read-only connection exists", () => {
    const one = render(ConnectionsManager, {
      props: { setup: setupData({ gatewayKeys: [KEY] }), enforceScope: true },
    });
    expect(one.getByText(/Need your app to add or update facts in your graph too\?/i)).toBeTruthy();
    expect(one.getByRole("button", { name: /Add a read \+ write connection/i })).toBeTruthy();
    one.unmount();

    const two = render(ConnectionsManager, {
      props: {
        setup: setupData({
          gatewayKeys: [KEY, { ...KEY, id: "k2", label: "backend" }],
        }),
        enforceScope: true,
      },
    });
    expect(two.queryByText(/Need your app to add or update facts/i)).toBeNull();
  });

  it("the suggestion opens the add form preset to read + write", async () => {
    const { getByRole, getByText } = render(ConnectionsManager, {
      props: { setup: setupData({ gatewayKeys: [KEY] }), enforceScope: true },
    });
    await fireEvent.click(getByRole("button", { name: /Add a read \+ write connection/i }));
    expect(getByRole("heading", { name: "What do you want to connect?" })).toBeTruthy();
    expect(getByText(/This connection is read \+ write/i)).toBeTruthy();
  });

  it("+ Add connection toggles the fork (read access, add variant)", async () => {
    const { getByRole, getByText, queryByRole } = render(ConnectionsManager, {
      props: { setup: setupData({ gatewayKeys: [KEY] }), enforceScope: true },
    });
    const addBtn = getByRole("button", { name: "+ Add connection" });
    expect(addBtn.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(addBtn);
    expect(addBtn.getAttribute("aria-expanded")).toBe("true");
    expect(getByText(/New connections start read-only/i)).toBeTruthy();
    await fireEvent.click(addBtn);
    expect(queryByRole("heading", { name: "What do you want to connect?" })).toBeNull();
  });

  it("delete flows through the detail view with a blast-radius confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole, getByText, queryByText } = render(ConnectionsManager, {
      props: { setup: setupData({ gatewayKeys: [KEY] }), enforceScope: true },
    });

    await fireEvent.click(getByRole("button", { name: "Details" }));
    await fireEvent.click(getByRole("button", { name: "Delete this connection" }));
    // Blast radius stated (copy pack §4.4); focus relocated to the safe choice.
    expect(getByText(/Your app loses access immediately — any code using this key stops working/i)).toBeTruthy();
    expect(document.activeElement?.textContent).toMatch(/Keep it/i);

    await fireEvent.click(getByRole("button", { name: "Delete connection" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/projects/proj_1/keys");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ keyId: "k1" });
    await waitFor(() => expect(queryByText("agent")).toBeNull());
  });

  it("Keep it cancels and returns focus to the delete affordance", async () => {
    const { getByRole } = render(ConnectionsManager, {
      props: { setup: setupData({ gatewayKeys: [KEY] }), enforceScope: true },
    });
    await fireEvent.click(getByRole("button", { name: "Details" }));
    await fireEvent.click(getByRole("button", { name: "Delete this connection" }));
    await fireEvent.click(getByRole("button", { name: "Keep it" }));
    const del = getByRole("button", { name: "Delete this connection" });
    expect(document.activeElement).toBe(del);
  });
});
