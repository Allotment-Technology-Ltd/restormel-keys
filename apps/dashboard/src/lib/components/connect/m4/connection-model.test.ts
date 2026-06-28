import { describe, it, expect } from "vitest";
import {
  CONNECTION_METHODS,
  CONNECTION_ACCESS,
  availableMethods,
  comingSoonMethods,
  wizardStepsFor,
  nextWizardStep,
  prevWizardStep,
  connectionSlug,
  connectionEndpoint,
  deriveMockMethod,
  deriveMockAccess,
  connectionName,
  connectionFromKey,
  buildWizardPreview,
  getMethod,
  getAccess,
} from "./connection-model";

describe("connection-model — MVP method gating (REC-ADR-018 addendum: MCP+REST only)", () => {
  it("exposes exactly MCP + REST as available; widget/SDK/GraphQL are coming-soon", () => {
    expect(availableMethods().map((m) => m.id).sort()).toEqual(["mcp", "rest"]);
    expect(comingSoonMethods().map((m) => m.id).sort()).toEqual(["graphql", "sdk", "widget"]);
  });

  it("every method carries an icon kind, a tag, and a description (icons not letters)", () => {
    for (const m of CONNECTION_METHODS) {
      expect(m.icon).toBe(m.id);
      expect(m.tag.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.namePlaceholder.length).toBeGreaterThan(0);
    }
  });

  it("getMethod/getAccess throw on unknown ids (no silent fallthrough)", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => getMethod("nope")).toThrow();
    // @ts-expect-error — exercising the runtime guard
    expect(() => getAccess("nope")).toThrow();
  });
});

describe("connection-model — access (plain language, read-only is the safe default)", () => {
  it("read is the default, read+write is opt-in", () => {
    expect(CONNECTION_ACCESS.find((a) => a.isDefault)?.id).toBe("read");
    expect(CONNECTION_ACCESS.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it("badges are READ / READ+WRITE", () => {
    expect(getAccess("read").badge).toBe("READ");
    expect(getAccess("read_write").badge).toBe("READ+WRITE");
  });
});

describe("connection-model — wizard step machine", () => {
  it("MCP + REST walk Type → Access → Name", () => {
    expect(wizardStepsFor("mcp")).toEqual(["type", "access", "name"]);
    expect(wizardStepsFor("rest")).toEqual(["type", "access", "name"]);
    expect(nextWizardStep("type", "mcp")).toBe("access");
    expect(nextWizardStep("access", "mcp")).toBe("name");
    expect(nextWizardStep("name", "mcp")).toBeNull();
    expect(prevWizardStep("name", "mcp")).toBe("access");
    expect(prevWizardStep("type", "mcp")).toBeNull();
  });

  it("a method without access meaning skips the access step", () => {
    // widget is coming-soon but its step machine still proves the access-skip rule
    expect(wizardStepsFor("widget")).toEqual(["type", "name"]);
    expect(nextWizardStep("type", "widget")).toBe("name");
    expect(prevWizardStep("name", "widget")).toBe("type");
  });
});

describe("connection-model — mock endpoint (presentational, realistic)", () => {
  it("slugs names and never emits a trailing slash or double slash", () => {
    expect(connectionSlug("  Agent Read Only!! ")).toBe("agent-read-only");
    expect(connectionSlug("")).toBe("connection");
    const ep = connectionEndpoint({
      connectApiBase: "https://connect.restormel.dev/",
      method: "mcp",
      name: "agent",
    });
    expect(ep).toBe("https://connect.restormel.dev/connect/invoke#agent");
    expect(ep).not.toMatch(/\/\/connect\//);
  });

  it("REST and MCP map to distinct surfaces", () => {
    const base = "https://connect.restormel.dev";
    expect(connectionEndpoint({ connectApiBase: base, method: "rest", name: "backend" })).toContain(
      "/connect/v1/retrieve",
    );
    expect(connectionEndpoint({ connectApiBase: base, method: "mcp", name: "agent" })).toContain(
      "/connect/invoke",
    );
  });
});

describe("connection-model — mock scope inference (NEVER a security decision)", () => {
  it("defaults to MCP + read for an unlabelled key", () => {
    expect(deriveMockMethod(null)).toBe("mcp");
    expect(deriveMockMethod("")).toBe("mcp");
    expect(deriveMockAccess(undefined)).toBe("read");
  });

  it("reads cosmetic hints from the label", () => {
    expect(deriveMockMethod("prod backend (REST)")).toBe("rest");
    expect(deriveMockMethod("site chat widget")).toBe("widget");
    expect(deriveMockAccess("agent read+write ingest")).toBe("read_write");
    expect(deriveMockAccess("readonly lookup")).toBe("read");
  });

  it("connectionName falls back to the method placeholder when unlabelled", () => {
    expect(connectionName("Cursor MCP", "mcp")).toBe("Cursor MCP");
    expect(connectionName("", "rest")).toBe("backend");
    expect(connectionName(null, "mcp")).toBe("agent");
  });

  it("connectionFromKey builds a presentational view flagged isMockScope", () => {
    const view = connectionFromKey({
      id: "key_1",
      keyPrefix: "rk_live_ab",
      label: "agent read+write",
      projectId: "proj_1",
    });
    expect(view).toMatchObject({
      keyId: "key_1",
      keyPrefix: "rk_live_ab",
      method: "mcp",
      access: "read_write",
      projectId: "proj_1",
      isMockScope: true,
    });
    expect(view.name).toBe("agent read+write");
  });
});

describe("connection-model — wizard live preview", () => {
  it("fills rows in as steps complete; later rows stay pending", () => {
    const empty = buildWizardPreview({
      method: null,
      access: null,
      name: "",
      connectApiBase: "https://connect.restormel.dev",
    });
    expect(empty.find((r) => r.key === "Type")?.pending).toBe(true);
    expect(empty.every((r) => r.pending)).toBe(true);

    const full = buildWizardPreview({
      method: "mcp",
      access: "read",
      name: "agent",
      connectApiBase: "https://connect.restormel.dev",
    });
    expect(full.find((r) => r.key === "Type")?.value).toBe("MCP server");
    expect(full.find((r) => r.key === "Access")?.value).toBe("Read-only");
    expect(full.find((r) => r.key === "Access")?.pending).toBe(false);
    expect(full.find((r) => r.key === "Name")?.value).toBe("agent");
    expect(full.find((r) => r.key === "Endpoint")?.value).toContain("/connect/invoke#agent");
    // Key is only ever shown on create — always pending in the preview.
    expect(full.find((r) => r.key === "Key")?.pending).toBe(true);
  });
});
