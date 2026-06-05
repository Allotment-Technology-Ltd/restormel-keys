import { describe, expect, it } from "vitest";
import { normalizePostHogEmbedUrl } from "./posthog-dashboard-embed";

describe("normalizePostHogEmbedUrl", () => {
  it("accepts EU PostHog embedded URLs", () => {
    expect(
      normalizePostHogEmbedUrl(
        "https://eu.posthog.com/embedded/abc123",
      ),
    ).toBe("https://eu.posthog.com/embedded/abc123");
  });

  it("rejects authenticated dashboard URLs", () => {
    expect(
      normalizePostHogEmbedUrl(
        "https://eu.posthog.com/project/123553/dashboard/726666",
      ),
    ).toBeNull();
  });

  it("rejects non-https URLs", () => {
    expect(normalizePostHogEmbedUrl("http://eu.posthog.com/embedded/x")).toBeNull();
  });
});
