import { describe, expect, it } from "vitest";
import { parsePostRunsBody } from "./post-body.js";

describe("parsePostRunsBody", () => {
  it("requires suite_id", () => {
    expect(parsePostRunsBody({}).ok).toBe(false);
  });

  it("accepts minimal body", () => {
    const r = parsePostRunsBody({ suite_id: "web-critical" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.suite_id).toBe("web-critical");
  });

  it("rejects bad goal_ids", () => {
    const r = parsePostRunsBody({ suite_id: "s", goal_ids: [1] });
    expect(r.ok).toBe(false);
  });
});
