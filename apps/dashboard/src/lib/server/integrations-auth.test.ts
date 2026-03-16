/**
 * Provider Integrations API: workspace and actor resolution.
 */
import { describe, it, expect, vi } from "vitest";
import { getWorkspaceAndActor } from "./integrations-auth";

vi.mock("$lib/server/neon", () => ({
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws-1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
  }),
}));

describe("getWorkspaceAndActor", () => {

  it("returns null when user is missing", async () => {
    const result = await getWorkspaceAndActor({});
    expect(result).toBeNull();
  });

  it("returns null for gateway_key (integrations are workspace-scoped)", async () => {
    const result = await getWorkspaceAndActor({
      user: {
        uid: "u1",
        authType: "gateway_key",
        keyId: "k1",
      },
    });
    expect(result).toBeNull();
  });

  it("returns workspace and actor for management_key", async () => {
    const result = await getWorkspaceAndActor({
      user: {
        uid: "",
        authType: "management_key",
        keyId: "mk1",
        workspaceId: "ws-mgmt",
      },
    });
    expect(result).toEqual({
      workspaceId: "ws-mgmt",
      actorId: "mk1",
      actorType: "management_key",
    });
  });

  it("returns workspace and actor for session user", async () => {
    const result = await getWorkspaceAndActor({
      user: { uid: "u1" },
    });
    expect(result).toMatchObject({
      workspaceId: "ws-1",
      actorId: "u1",
      actorType: "user",
    });
  });
});
