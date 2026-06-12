/**
 * Stage K4 — client contract tests: project-readiness issue fix-link routing
 * (the project card's repair receipts) and panel-state resolution.
 */
import { describe, it, expect } from "vitest";
import {
  projectReadinessIssueFix,
  readinessChipLabel,
  overallReadinessStatus,
  resolveReadinessPanelState,
} from "./verified-readiness";

const BASE = "/keys/dashboard";
const PROJECT = "proj-1";

describe("projectReadinessIssueFix — fix-link routing per readiness issue code", () => {
  it("no_provider_bindings → Connections", () => {
    expect(projectReadinessIssueFix("no_provider_bindings", PROJECT, BASE)).toEqual({
      href: `${BASE}/integrations`,
      label: "Open Connections",
    });
  });

  it("no_routes and routes_without_enabled_steps → project Routes", () => {
    for (const code of ["no_routes", "routes_without_enabled_steps"]) {
      expect(projectReadinessIssueFix(code, PROJECT, BASE)).toEqual({
        href: `${BASE}/projects/${PROJECT}/routes`,
        label: "Open Routes",
      });
    }
  });

  it("no_project_policy_binding → Policies", () => {
    expect(projectReadinessIssueFix("no_project_policy_binding", PROJECT, BASE)).toEqual({
      href: `${BASE}/policies`,
      label: "Open Policies",
    });
  });

  it("connect_run_no_stage_routes → Connect Models", () => {
    expect(projectReadinessIssueFix("connect_run_no_stage_routes", PROJECT, BASE)).toEqual({
      href: `${BASE}/connect/models`,
      label: "Configure routes",
    });
  });

  it("unknown codes → null (issue renders without a fix link, never a broken one)", () => {
    expect(projectReadinessIssueFix("totally_new_code", PROJECT, BASE)).toBeNull();
  });
});

describe("panel/summary helpers", () => {
  it("chip label", () => {
    expect(readinessChipLabel({ ready: 0, total: 6 })).toBe("Connect: 0/6 ready");
    expect(readinessChipLabel({ ready: 6, total: 6 })).toBe("Connect: 6/6 ready");
  });

  it("overall status: fail beats warn beats ok", () => {
    expect(overallReadinessStatus([{ status: "ok" }, { status: "ok" }])).toBe("ok");
    expect(overallReadinessStatus([{ status: "ok" }, { status: "warn" }])).toBe("warn");
    expect(overallReadinessStatus([{ status: "warn" }, { status: "fail" }])).toBe("fail");
    expect(overallReadinessStatus([])).toBe("ok");
  });

  it("panel state never shows a silent blank: null while signed in is an error", () => {
    expect(resolveReadinessPanelState(true, null)).toBe("error");
    expect(resolveReadinessPanelState(true, undefined)).toBe("error");
    expect(resolveReadinessPanelState(false, null)).toBe("signed_out");
  });
});
