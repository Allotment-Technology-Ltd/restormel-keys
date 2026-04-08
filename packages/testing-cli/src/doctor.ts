import { access, constants } from "node:fs/promises";
import { resolvePathUnderRoot } from "@restormel/testing-core";
import { keysAdapterOptionsFromProcessEnv } from "@restormel/testing-keys-adapter";
import { chromium } from "playwright";

/**
 * Minimal prerequisite checks (no secret values printed).
 * Exit 0 = OK, 2 = hard failure (Node / browser / missing config file).
 */
export async function runDoctor(opts: { config?: string }): Promise<number> {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (Number.isNaN(major) || major < 20) {
    console.error(`doctor: Node 20+ required (got ${process.version})`);
    return 2;
  }
  console.log(`doctor: Node ${process.version} OK`);

  if (opts.config !== undefined) {
    const resolved = resolvePathUnderRoot(process.cwd(), opts.config);
    if (!resolved.ok) {
      console.error(`doctor: ${resolved.reason}`);
      return 2;
    }
    try {
      await access(resolved.path, constants.R_OK);
      console.log(`doctor: config readable (${opts.config})`);
    } catch {
      console.error(`doctor: config not readable: ${opts.config}`);
      return 2;
    }
  }

  try {
    const exe = chromium.executablePath();
    console.log(`doctor: Playwright Chromium executable OK`);
    console.log(`  ${exe}`);
  } catch {
    console.error(
      "doctor: Playwright Chromium not installed — run:\n  pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium",
    );
    return 2;
  }

  const keysBase = process.env.RESTORMEL_KEYS_API_BASE_URL?.trim();
  const projectId = process.env.RESTORMEL_PROJECT_ID?.trim();
  const fallback = process.env.RESTORMEL_TESTING_OPENAI_FALLBACK?.trim() === "1";
  if (keysBase) {
    console.log("doctor: RESTORMEL_KEYS_API_BASE_URL is set (value not shown)");
    if (projectId) {
      console.log("doctor: RESTORMEL_PROJECT_ID is set (value not shown)");
    } else {
      console.log(
        "doctor: RESTORMEL_PROJECT_ID not set — use the Restormel Testing page in the Keys dashboard to copy your project id",
      );
    }
  } else if (fallback) {
    console.log("doctor: RESTORMEL_TESTING_OPENAI_FALLBACK=1 (OpenAI env fallback may be used for judges)");
  } else {
    console.log(
      "doctor: Keys HTTP not set — goals with judge_rubric need RESTORMEL_KEYS_API_BASE_URL or RESTORMEL_TESTING_OPENAI_FALLBACK=1",
    );
  }

  const adapterOpts = keysAdapterOptionsFromProcessEnv();
  if (adapterOpts?.keysApiBaseUrl) {
    const tokenVar = adapterOpts.keysApiTokenEnvVar ?? "RESTORMEL_KEYS_API_TOKEN";
    const token = process.env[tokenVar]?.trim();
    if (!token) {
      console.log(`doctor: Keys probe skipped — ${tokenVar} not set`);
    } else {
      const root = adapterOpts.keysApiBaseUrl.replace(/\/?$/, "");
      const url = `${root}/v1/testing/resolve-model`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logicalRef: "ref:restormel-keys:doctor/probe" }),
        });
        console.log(`doctor: Keys resolve POST → HTTP ${res.status} (response body not printed)`);
      } catch (e) {
        console.error(`doctor: Keys resolve probe failed: ${e instanceof Error ? e.message : String(e)}`);
        return 2;
      }
    }
  }

  return 0;
}
