/**
 * One-shot demo: static server on :4173, then validate + run web-critical.
 * Run from repo root after: pnpm install && pnpm run build:packages
 * and once: pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
 *
 * Usage (from this directory):
 *   pnpm run demo
 */
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = dirname(fileURLToPath(import.meta.url));
const baseUrl = "http://127.0.0.1:4173";
const shell = process.platform === "win32";

/** Loopback-only URL for the demo server (mitigates SSRF if this helper is reused). */
function assertLoopbackHttpUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Only http(s) URLs are allowed: ${url}`);
  }
  const host = u.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(`URL host must be loopback: ${url}`);
  }
  return u.href;
}

async function waitForHttp(url, timeoutMs = 25_000) {
  const safeUrl = assertLoopbackHttpUrl(url);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(safeUrl);
      res.body?.cancel?.();
      if (res.ok || (res.status >= 200 && res.status < 500)) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runPnpmExec(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", ...args], {
      cwd,
      stdio: "inherit",
      shell,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm exec ${args.join(" ")} exited ${code}`));
    });
  });
}

const serve = spawn("pnpm", ["exec", "serve", "-l", "4173", "."], {
  cwd,
  stdio: "inherit",
  shell,
});

let exitCode = 1;
try {
  await waitForHttp(baseUrl);
  await runPnpmExec(["testing", "validate", "--config", "restormel-testing.yaml"]);
  await runPnpmExec(["testing", "run", "--suite", "web-critical", "--config", "restormel-testing.yaml"]);
  exitCode = 0;
  console.log("\nDemo OK — see artefact path printed above (.restormel-testing/runs/…).");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
} finally {
  serve.kill("SIGTERM");
}

process.exit(exitCode);
