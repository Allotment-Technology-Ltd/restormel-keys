/**
 * RES-113 PR-8 — §2.8 reachability pin (placement spec §5 item 9: "no cost
 * strings reachable from Home/Build/journey surfaces").
 *
 * Copy pack §2.8 allows exactly TWO render surfaces for verification-economics
 * strings: rows on the Metrics page (`/analytics`) and one line inside the run
 * console's "Show details" disclosure. This test walks every dashboard source
 * file and asserts the §2.8 strings appear NOWHERE else — in particular never in
 * Home (`/home`, home-state), Build (sources / pipeline wizard / launch panel),
 * the journey chrome (JourneyNav / JourneyWelcome / banners), or nav-config.
 * A new occurrence outside the allowlist is a spec violation, not a test to fix.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/** Lower-cased distinctive markers for every §2.8 string family. */
const ECON_MARKERS = [
  "facts checked",
  "checked against the documents they came from",
  "re-used from earlier build",
  "results carried over from an earlier build",
  "sent for a closer look",
  "facts the quick check couldn't settle",
  "facts waiting for your verdict in verify",
  "what the checks cost to run",
] as const;

/** The ONLY files that may carry §2.8 strings (spec §5 item 9 surfaces + their tests). */
const ALLOWLIST = new Set(
  [
    "lib/connect/verification-economics.ts",
    "lib/connect/verification-economics.test.ts",
    "lib/connect/verification-economics.reachability.test.ts",
    "routes/keys/dashboard/analytics/+page.svelte",
    "routes/keys/dashboard/analytics/analytics-page.server.test.ts",
    "lib/components/connect/pipeline/ConnectIngestRunConsole.svelte",
    "lib/components/connect/pipeline/ConnectIngestRunConsole.economics.test.ts",
  ].map((p) => p.split("/").join(sep)),
);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(ts|svelte|js)$/.test(name)) yield full;
  }
}

describe("§2.8 economics strings — reachable only from the two spec surfaces", () => {
  it("no §2.8 string appears outside the Metrics page + run-console details (+ derivation/tests)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file);
      if (ALLOWLIST.has(rel)) continue;
      const content = readFileSync(file, "utf8").toLowerCase();
      for (const marker of ECON_MARKERS) {
        if (content.includes(marker)) offenders.push(`${rel} :: ${marker}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Home, Build, and journey chrome name none of the §2.8 surfaces' modules", () => {
    // Belt-and-braces on top of the string scan: outside `lib/server/**` (data
    // plumbing that renders nothing) and this page's loader, the derivation
    // module is imported ONLY by the two render surfaces and their tests.
    const offenders: string[] = [];
    const serverPrefix = join("lib", "server") + sep;
    const analyticsLoader = join(
      "routes", "keys", "dashboard", "analytics", "+page.server.ts",
    );
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file);
      if (ALLOWLIST.has(rel)) continue;
      if (rel.startsWith(serverPrefix) || rel === analyticsLoader) continue;
      const content = readFileSync(file, "utf8");
      if (content.includes("verification-economics")) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
