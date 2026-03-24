import { describe, expect, it } from "vitest";
import {
  hrefToDashboardUiSection,
  isDashboardHrefUiHidden,
  pathnameToDashboardUiSection,
} from "./dashboard-ui-path-match";

describe("dashboard-ui-path-match", () => {
  it("maps top-level dashboard paths", () => {
    expect(pathnameToDashboardUiSection("/keys/dashboard/policies")).toBe("policies");
    expect(pathnameToDashboardUiSection("/keys/dashboard/policies/p1")).toBe("policies");
    expect(pathnameToDashboardUiSection("/keys/dashboard/routes")).toBe("routes");
    expect(pathnameToDashboardUiSection("/keys/dashboard/models")).toBe("models");
    expect(pathnameToDashboardUiSection("/keys/dashboard/integrations")).toBe("providers");
    expect(pathnameToDashboardUiSection("/keys/dashboard/analytics")).toBe("analytics");
    expect(pathnameToDashboardUiSection("/keys/dashboard/logs")).toBe("logs");
    expect(pathnameToDashboardUiSection("/keys/dashboard/healthcheck")).toBe("healthcheck");
    expect(pathnameToDashboardUiSection("/keys/dashboard/sandbox")).toBe("sandbox");
    expect(pathnameToDashboardUiSection("/keys/dashboard/copy-for-ci")).toBe("copy-for-ci");
    expect(pathnameToDashboardUiSection("/keys/dashboard/dev-tools")).toBe("dev-tools");
    expect(pathnameToDashboardUiSection("/keys/dashboard/billing")).toBe("billing");
  });

  it("maps lifecycle to models section", () => {
    expect(pathnameToDashboardUiSection("/keys/dashboard/lifecycle")).toBe("models");
  });

  it("maps project route editor to routes section", () => {
    expect(pathnameToDashboardUiSection("/keys/dashboard/projects/p1/routes")).toBe("routes");
    expect(pathnameToDashboardUiSection("/keys/dashboard/projects/p1/routes/r1")).toBe("routes");
  });

  it("maps project root to projects section", () => {
    expect(pathnameToDashboardUiSection("/keys/dashboard/projects")).toBe("projects");
    expect(pathnameToDashboardUiSection("/keys/dashboard/projects/p1")).toBe("projects");
  });

  it("does not gate login api settings", () => {
    expect(pathnameToDashboardUiSection("/keys/dashboard/login")).toBe(null);
    expect(pathnameToDashboardUiSection("/keys/dashboard/api/foo")).toBe(null);
    expect(pathnameToDashboardUiSection("/keys/dashboard/settings")).toBe(null);
  });

  it("hrefToDashboardUiSection strips query", () => {
    expect(hrefToDashboardUiSection("/keys/dashboard/sandbox?tab=preview")).toBe("sandbox");
  });

  it("isDashboardHrefUiHidden respects hidden set", () => {
    const hidden = new Set(["policies"]);
    expect(isDashboardHrefUiHidden("/keys/dashboard/policies", hidden)).toBe(true);
    expect(isDashboardHrefUiHidden("/keys/dashboard/access", hidden)).toBe(false);
    expect(isDashboardHrefUiHidden("/keys/docs", hidden)).toBe(false);
  });
});
