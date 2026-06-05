import { describe, expect, it } from "vitest";
import { parseGraphRevalidateRequest } from "./graph-revalidate-request";

describe("parseGraphRevalidateRequest", () => {
  it("accepts auto-remediation quarantine scope", () => {
    const parsed = parseGraphRevalidateRequest({
      scope: "quarantine",
      mode: "validate_and_remediate",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scope).toBe("quarantine");
      expect(parsed.data.mode).toBe("validate_and_remediate");
    }
  });

  it("accepts auto-remediation unsupported scope", () => {
    const parsed = parseGraphRevalidateRequest({
      scope: "unsupported",
      mode: "validate_and_remediate",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scope).toBe("unsupported");
    }
  });

  it("rejects unknown scope values", () => {
    const parsed = parseGraphRevalidateRequest({ scope: "bogus" });
    expect(parsed.success).toBe(false);
  });
});
