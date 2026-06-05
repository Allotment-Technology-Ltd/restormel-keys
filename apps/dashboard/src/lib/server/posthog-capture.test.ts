import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureServerPostHogEvent,
  workspacePostHogDistinctId,
} from "./posthog-capture";

describe("posthog-capture", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    process.env.POSTHOG_API_KEY = "phc_test_key";
    process.env.POSTHOG_HOST = "https://eu.i.posthog.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_HOST;
  });

  it("posts capture payload without logging note bodies", async () => {
    await captureServerPostHogEvent("ws_abc12345", "connect_review_completed", {
      human_note: "operator context",
      verdict_delta: "weak_to_ok",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    const body = JSON.parse(String(init.body));
    expect(body.event).toBe("connect_review_completed");
    expect(body.distinct_id).toBe("ws_abc12345");
    expect(body.properties.human_note).toBe("operator context");
    expect(body.properties.$lib).toBe("restormel-dashboard-server");
  });

  it("no-ops when api key missing", async () => {
    fetchMock.mockClear();
    delete process.env.POSTHOG_API_KEY;
    delete process.env.PUBLIC_POSTHOG_KEY;
    await captureServerPostHogEvent("ws_abc12345", "connect_ingest_completed", {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hashes workspace distinct id prefix", () => {
    expect(workspacePostHogDistinctId("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "ws_01234567",
    );
  });
});
