import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GoalRunRecord } from "@restormel/testing-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countGoalVerdicts,
  getTelemetryStatus,
  isTelemetrySendingEnabled,
  sendTelemetrySnapshot,
  setTelemetrySendingEnabled,
} from "./telemetry.js";

function goal(verdict: GoalRunRecord["verdict"]): GoalRunRecord {
  return {
    goalId: "g",
    verdict,
    reasonCode: "OK",
    summary: "",
    retriesUsed: 0,
    evidenceRefs: [],
  };
}

describe("countGoalVerdicts", () => {
  it("aggregates goal verdicts", () => {
    expect(
      countGoalVerdicts([goal("passed"), goal("failed"), goal("indeterminate"), goal("passed")]),
    ).toEqual({ passed: 2, failed: 1, indeterminate: 1 });
  });
});

describe("telemetry file + env", () => {
  let prevHome: string | undefined;
  let tmpHome: string;

  beforeEach(async () => {
    prevHome = process.env.HOME;
    tmpHome = await mkdtemp(join(tmpdir(), "rt-tel-"));
    process.env.HOME = tmpHome;
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    process.env.HOME = prevHome;
    await rm(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("defaults to sending when no file and no env", async () => {
    expect(await isTelemetrySendingEnabled()).toBe(true);
    const s = await getTelemetryStatus();
    expect(s.sending).toBe(true);
    expect(s.source).toBe("default");
  });

  it("respects saved opt-out", async () => {
    await setTelemetrySendingEnabled(false);
    expect(await isTelemetrySendingEnabled()).toBe(false);
    const s = await getTelemetryStatus();
    expect(s.sending).toBe(false);
    expect(s.source).toBe("file");
    const raw = JSON.parse(await readFile(join(tmpHome, ".restormel", "telemetry.json"), "utf8")) as {
      enabled: boolean;
    };
    expect(raw.enabled).toBe(false);
  });

  it("RESTORMEL_TELEMETRY=0 overrides file", async () => {
    await setTelemetrySendingEnabled(true);
    vi.stubEnv("RESTORMEL_TELEMETRY", "0");
    expect(await isTelemetrySendingEnabled()).toBe(false);
  });
});

describe("sendTelemetrySnapshot", () => {
  it("POSTs JSON and ignores fetch errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendTelemetrySnapshot({
        command: "validate",
        suiteCount: 2,
        goalCount: 5,
        verdictPassed: 1,
        verdictFailed: 0,
        verdictIndeterminate: 0,
      }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://telemetry.restormel.dev/v1/event",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body.command).toBe("validate");
    expect(body.suite_count).toBe(2);
    expect(body.goal_count).toBe(5);
    expect(body.node_version).toBeDefined();
    expect(body.platform).toBeDefined();
    vi.unstubAllGlobals();
  });
});
