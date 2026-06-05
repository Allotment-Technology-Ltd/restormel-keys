import { describe, expect, it } from "vitest";
import { WORKSPACE_HOME_HREF } from "$lib/nav-config";
import { buildPostAuthLocation } from "./auth-return-cookie";

describe("buildPostAuthLocation", () => {
  it("uses safe redirect and appends template query", () => {
    const loc = buildPostAuthLocation("https://restormel.dev", {
      redirect: "/keys/dashboard/connect/pipeline?step=domain",
      template: "engineering-knowledge",
    }, "/keys/dashboard/");
    expect(loc).toBe(
      "/keys/dashboard/connect/pipeline?step=domain&template=engineering-knowledge",
    );
  });

  it("rejects open redirect and falls back", () => {
    const loc = buildPostAuthLocation("https://restormel.dev", {
      redirect: "https://evil.example/phish",
      template: "mythology-pantheons",
    }, "/keys/dashboard/");
    expect(loc).toBe(`${WORKSPACE_HOME_HREF}?template=mythology-pantheons`);
  });
});
