import { describe, expect, it } from "vitest";
import type { RunRecord } from "@restormel/testing-core";
import { buildMvpJsonReport } from "./mvp-json-report.js";
import { buildReleasePackV1, RELEASE_PACK_SCHEMA_VERSION, serializeReleasePackV1 } from "./release-pack.js";

const minimalRun = {
  id: "run-1",
  suiteId: "s1",
  environmentId: "env-1",
  verdict: "passed" as const,
  goalRuns: [],
} satisfies RunRecord;

describe("release-pack", () => {
  it("builds v1 with control plane refs and serializes", () => {
    const mvp = buildMvpJsonReport({ run: minimalRun });
    const pack = buildReleasePackV1({
      mvpReport: mvp,
      controlPlane: { route_version: "route@2", policy_version: "policy@1" },
      artifactDir: "/tmp/run",
    });
    expect(pack.schema_version).toBe(RELEASE_PACK_SCHEMA_VERSION);
    expect(pack.control_plane?.route_version).toBe("route@2");
    expect(pack.testing.verdict).toBe("passed");
    const s = serializeReleasePackV1(pack);
    expect(s).toContain("restormel-release-pack/1");
    expect(s).toContain("mvp_report");
  });
});
