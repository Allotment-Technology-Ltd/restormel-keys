import type { Verdict } from "@restormel/testing-core";
import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

type CriteriaEvaluation = {
  verdict: Verdict;
  reasonCode: string;
  summary: string;
  judgeModelInvocations?: number;
};

/** Lighthouse category ids accepted in structured_checks paths. */
export const LIGHTHOUSE_CATEGORY_IDS = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
  "pwa",
] as const;

export type LighthouseCategoryId = (typeof LIGHTHOUSE_CATEGORY_IDS)[number];

/**
 * Parse `lighthouse:*` / `lh:*` structured check paths.
 * `full` / `all` runs the four core categories (excludes pwa by default — use `lighthouse:pwa` separately).
 */
export function parseLighthouseStructuredPath(path: string): LighthouseCategoryId[] | null {
  const p = path.trim().toLowerCase();
  const single: Record<string, LighthouseCategoryId> = {
    "lighthouse:performance": "performance",
    "lh:performance": "performance",
    "lighthouse:accessibility": "accessibility",
    "lh:accessibility": "accessibility",
    "lighthouse:best-practices": "best-practices",
    "lh:best-practices": "best-practices",
    "lighthouse:seo": "seo",
    "lh:seo": "seo",
    "lighthouse:pwa": "pwa",
    "lh:pwa": "pwa",
  };
  if (single[p] !== undefined) {
    return [single[p]!];
  }
  if (p === "lighthouse:full" || p === "lh:full" || p === "lighthouse:all" || p === "lh:all") {
    return ["performance", "accessibility", "best-practices", "seo"];
  }
  return null;
}

/** Minimum category score 0–1 from YAML `expect` (0–100 integer or 0–1 fraction). */
export function lighthouseMinScore01(expect?: unknown): number | undefined {
  if (expect === undefined || expect === null) {
    return 0.5;
  }
  if (typeof expect !== "number" || !Number.isFinite(expect)) {
    return undefined;
  }
  if (expect > 100 || expect < 0) {
    return undefined;
  }
  if (expect > 1) {
    return expect / 100;
  }
  return expect;
}

function getenvMs(name: string, defaultMs: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === "") {
    return defaultMs;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 5000 ? n : defaultMs;
}

/**
 * Runs Lighthouse in a **separate** headless Chrome (via chrome-launcher), not the Playwright page session.
 * Cookies / storage from Playwright are **not** applied — use for public URLs or accept re-auth limitations.
 */
export async function evaluateLighthouseStructuredCheck(
  pageUrl: string,
  check: { path: string; id?: string; expect?: unknown },
  categories: LighthouseCategoryId[],
): Promise<CriteriaEvaluation> {
  if (process.env.RESTORMEL_TESTING_SKIP_LIGHTHOUSE?.trim() === "1") {
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_SKIPPED",
      summary: `${check.id ?? check.path}: skipped (RESTORMEL_TESTING_SKIP_LIGHTHOUSE=1)`,
    };
  }

  const minScore = lighthouseMinScore01(check.expect);
  if (minScore === undefined) {
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_EXPECT_INVALID",
      summary: `${check.id ?? check.path}: expect must be 0–100 (score %) or 0–1 (fraction)`,
    };
  }

  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_BAD_URL",
      summary: "Cannot run Lighthouse: page URL is not absolute",
    };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_BAD_URL",
      summary: "Lighthouse requires http(s) URL",
    };
  }

  const label = check.id ?? check.path;
  const timeoutMs = getenvMs("RESTORMEL_TESTING_LIGHTHOUSE_TIMEOUT_MS", 180_000);
  const chromePath = chromium.executablePath();

  let chrome: Awaited<ReturnType<typeof launchChrome>> | undefined;
  try {
    chrome = await launchChrome({
      chromePath,
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    const run = async () => {
      const result = await lighthouse(u.href, {
        logLevel: "error",
        output: "json",
        onlyCategories: [...categories],
        port: chrome!.port,
        screenEmulation: { disabled: true },
      });
      const lhr = result?.lhr as
        | {
            categories?: Record<string, { score: number | null } | undefined>;
          }
        | undefined;
      if (!lhr?.categories) {
        return {
          verdict: "indeterminate" as const,
          reasonCode: "LIGHTHOUSE_NO_RESULT",
          summary: `${label}: Lighthouse returned no categories`,
        };
      }

      const failures: string[] = [];
      for (const id of categories) {
        const cat = lhr.categories[id];
        const score = cat?.score;
        if (score == null) {
          failures.push(`${id}:no-score`);
          continue;
        }
        if (score < minScore) {
          failures.push(`${id}:${Math.round(score * 100)}%<${Math.round(minScore * 100)}%`);
        }
      }

      if (failures.length > 0) {
        return {
          verdict: "failed" as const,
          reasonCode: "LIGHTHOUSE_SCORE_BELOW_MIN",
          summary: `${label}: ${failures.join(", ")}`,
        };
      }

      const parts = categories.map((id) => {
        const s = lhr.categories![id]?.score;
        return `${id}:${s == null ? "?" : `${Math.round(s * 100)}%`}`;
      });
      return {
        verdict: "passed" as const,
        reasonCode: "LIGHTHOUSE_OK",
        summary: `${label}: ${parts.join(", ")}`,
      };
    };

    const outcome = await Promise.race([
      run(),
      new Promise<CriteriaEvaluation>((_, reject) =>
        setTimeout(() => reject(new Error(`Lighthouse timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    return outcome;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_RUN_ERROR",
      summary: `${label}: ${msg}`,
    };
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        /* ignore */
      }
    }
  }
}
