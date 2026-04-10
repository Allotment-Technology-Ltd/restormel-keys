import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GoalRunRecord } from "@restormel/testing-core";
import { cliPackageVersion } from "./version.js";

/** POST target; failures are ignored (endpoint may not be live yet). */
const TELEMETRY_ENDPOINT = "https://telemetry.restormel.dev/v1/event";

export type TelemetryCommand = "run" | "validate" | "report" | "doctor";

export type TelemetrySnapshot = {
  command: TelemetryCommand;
  suiteCount: number;
  goalCount: number;
  verdictPassed: number;
  verdictFailed: number;
  verdictIndeterminate: number;
};

type TelemetryFile = {
  /** When false, user opted out via `telemetry disable`. Default when absent: opted in. */
  enabled?: boolean;
  firstRunNoticeShown?: boolean;
};

/** User-local opt-out file (same path used for first-run notice flag). */
export function telemetryUserConfigPath(): string {
  return join(homedir(), ".restormel", "telemetry.json");
}

function telemetryJsonPath(): string {
  return telemetryUserConfigPath();
}

function parseEnvOverride(): boolean | null {
  const raw = process.env.RESTORMEL_TELEMETRY?.trim();
  if (raw === undefined || raw === "") return null;
  const v = raw.toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return null;
}

async function readTelemetryFile(): Promise<TelemetryFile> {
  const path = telemetryJsonPath();
  try {
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TelemetryFile;
    }
  } catch {
    /* missing or invalid */
  }
  return {};
}

async function writeTelemetryFile(data: TelemetryFile): Promise<void> {
  const path = telemetryJsonPath();
  await mkdir(join(homedir(), ".restormel"), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Whether anonymous telemetry may be sent this process (env wins over file). */
export async function isTelemetrySendingEnabled(): Promise<boolean> {
  const env = parseEnvOverride();
  if (env !== null) return env;
  const file = await readTelemetryFile();
  return file.enabled !== false;
}

export type TelemetryStatus = {
  sending: boolean;
  source: "env" | "file" | "default";
  detail: string;
};

export async function getTelemetryStatus(): Promise<TelemetryStatus> {
  const env = parseEnvOverride();
  if (env !== null) {
    return {
      sending: env,
      source: "env",
      detail: env ? "RESTORMEL_TELEMETRY enables sending" : "RESTORMEL_TELEMETRY disables sending",
    };
  }
  const file = await readTelemetryFile();
  if (file.enabled === false) {
    return {
      sending: false,
      source: "file",
      detail: `disabled in ${telemetryJsonPath()}`,
    };
  }
  return {
    sending: true,
    source: "default",
    detail: "opt-in by default; no opt-out file entry",
  };
}

export async function setTelemetrySendingEnabled(enabled: boolean): Promise<void> {
  const prev = await readTelemetryFile();
  await writeTelemetryFile({
    ...prev,
    enabled,
    firstRunNoticeShown: true,
  });
}

const FIRST_RUN_MESSAGE = `Restormel Testing collects anonymous usage data to help improve the product. No code, credentials, or personal data is collected. You can opt out at any time by setting RESTORMEL_TELEMETRY=0 or running \`restormel-testing telemetry disable\`.
`;

/**
 * Once per machine (persisted), print policy to stderr before substantive commands.
 * Skipped when telemetry is off via env or file, or notice already recorded.
 */
export async function maybeShowFirstRunTelemetryNotice(program: string): Promise<void> {
  const env = parseEnvOverride();
  if (env === false) return;

  const file = await readTelemetryFile();
  if (file.enabled === false) return;
  if (file.firstRunNoticeShown) return;

  process.stderr.write(FIRST_RUN_MESSAGE.replaceAll("restormel-testing", program));
  await writeTelemetryFile({
    ...file,
    firstRunNoticeShown: true,
  });
}

export function countGoalVerdicts(goalRuns: GoalRunRecord[]): {
  passed: number;
  failed: number;
  indeterminate: number;
} {
  let passed = 0;
  let failed = 0;
  let indeterminate = 0;
  for (const g of goalRuns) {
    if (g.verdict === "passed") passed++;
    else if (g.verdict === "failed") failed++;
    else if (g.verdict === "indeterminate") indeterminate++;
  }
  return { passed, failed, indeterminate };
}

/**
 * POST with a short timeout; never throws.
 * TODO: endpoint may not be live yet — failures must remain silent.
 */
export async function sendTelemetrySnapshot(snapshot: TelemetrySnapshot): Promise<void> {
  const body = {
    product: "restormel-testing-cli",
    cli_version: cliPackageVersion(),
    command: snapshot.command,
    node_version: process.version,
    platform: process.platform,
    suite_count: snapshot.suiteCount,
    goal_count: snapshot.goalCount,
    verdict_passed: snapshot.verdictPassed,
    verdict_failed: snapshot.verdictFailed,
    verdict_indeterminate: snapshot.verdictIndeterminate,
  };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 800);
  try {
    await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch {
    /* silent — offline, DNS, non-2xx, timeout */
  } finally {
    clearTimeout(t);
  }
}
