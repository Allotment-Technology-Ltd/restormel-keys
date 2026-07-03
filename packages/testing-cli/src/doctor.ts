import { access, constants } from "node:fs/promises";
import { resolvePathUnderRoot } from "@restormel/testing-core";
import { keysAdapterOptionsFromProcessEnv, keysHttpBearerFromProcessEnv } from "@restormel/testing-keys-adapter";
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

  const adapterOpts = keysAdapterOptionsFromProcessEnv();
  const keysBaseForHint =
    process.env.RESTORMEL_KEYS_API_BASE_URL?.trim() || process.env.RESTORMEL_KEYS_BASE?.trim();
  const projectId = process.env.RESTORMEL_PROJECT_ID?.trim();
  const fallback = process.env.RESTORMEL_TESTING_OPENAI_FALLBACK?.trim() === "1";
  if (keysBaseForHint) {
    const baseVar = process.env.RESTORMEL_KEYS_API_BASE_URL?.trim()
      ? "RESTORMEL_KEYS_API_BASE_URL"
      : "RESTORMEL_KEYS_BASE";
    console.log(`doctor: ${baseVar} is set (value not shown)`);
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
      "doctor: Keys HTTP not set — goals with judge_rubric need RESTORMEL_KEYS_BASE (or RESTORMEL_KEYS_API_BASE_URL) or RESTORMEL_TESTING_OPENAI_FALLBACK=1",
    );
  }

  if (adapterOpts?.keysApiBaseUrl) {
    const token = keysHttpBearerFromProcessEnv(adapterOpts.keysApiTokenEnvVar);
    if (!token) {
      console.log(
        "doctor: Keys probe skipped — set RESTORMEL_GATEWAY_KEY or RESTORMEL_KEYS_API_TOKEN (or RESTORMEL_KEYS_API_TOKEN_ENV)",
      );
    } else {
      const root = adapterOpts.keysApiBaseUrl.replace(/\/?$/, "");
      const url = `${root}/v1/testing/resolve-model`;
      /** Bootstrap ref that exists for Testing projects (unlike ad-hoc `doctor/probe`-style strings with no binding). */
      const probeRef = "ref:restormel-keys:llm/primary";
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logicalRef: probeRef }),
        });
        console.log(`doctor: Keys resolve POST (${probeRef}) → HTTP ${res.status} (response body not printed)`);
        if (res.status === 404) {
          console.log(
            "doctor: HTTP 404 often means unknown logical ref or project/token mismatch — confirm RESTORMEL_PROJECT_ID and that the gateway key is for the same project as your judge bindings.",
          );
        } else if (res.status === 401 || res.status === 403) {
          console.log("doctor: HTTP 401/403 — check the gateway token variable and key scope.");
        }
      } catch (e) {
        console.error(`doctor: Keys resolve probe failed: ${e instanceof Error ? e.message : String(e)}`);
        return 2;
      }
    }
  }

  return 0;
}
