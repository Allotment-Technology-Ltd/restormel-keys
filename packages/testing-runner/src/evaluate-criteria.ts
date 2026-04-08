import type { Page } from "playwright";
import type { JudgeRubric, SuccessCriteria, Verdict } from "@restormel/testing-core";
import type { ResolvedModel } from "@restormel/testing-keys-adapter";

export interface CriteriaEvaluation {
  verdict: Verdict;
  reasonCode: string;
  summary: string;
  /** Set when an OpenAI-compatible judge request was sent (for Keys model meta). */
  judgeModelInvocations?: number;
}

function normalizeUrl(u: string): string {
  try {
    return new URL(u).href;
  } catch {
    return u;
  }
}

/**
 * Deterministic checks: URL, DOM visibility, text present/absent, minimal structured checks.
 * Judge rubric (optional) runs after deterministics all pass.
 */
export async function evaluateBrowserSuccessCriteria(
  page: Page,
  criteria: SuccessCriteria,
  options?: {
    judgeModel?: ResolvedModel;
  },
): Promise<CriteriaEvaluation> {
  const url = page.url();

  if (criteria.urlMatches !== undefined) {
    const patterns = Array.isArray(criteria.urlMatches) ? criteria.urlMatches : [criteria.urlMatches];
    const nu = normalizeUrl(url);
    for (const p of patterns) {
      if (!nu.includes(p) && !url.includes(p)) {
        return {
          verdict: "failed",
          reasonCode: "URL_MISMATCH",
          summary: `Expected URL to match ${JSON.stringify(p)}; got ${truncate(url, 200)}`,
        };
      }
    }
  }

  if (criteria.domSignals !== undefined && criteria.domSignals.length > 0) {
    for (const sel of criteria.domSignals) {
      const loc = page.locator(sel).first();
      const n = await locatorCountSafe(loc);
      if (n === 0) {
        return {
          verdict: "failed",
          reasonCode: "DOM_SIGNAL_MISSING",
          summary: `Expected element for selector ${JSON.stringify(sel)}`,
        };
      }
      const visible = await loc.isVisible().catch(() => false);
      if (!visible) {
        return {
          verdict: "failed",
          reasonCode: "DOM_NOT_VISIBLE",
          summary: `Selector ${JSON.stringify(sel)} exists but is not visible`,
        };
      }
    }
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const hay = bodyText.toLowerCase();

  if (criteria.textPresent !== undefined && criteria.textPresent.length > 0) {
    for (const t of criteria.textPresent) {
      if (!hay.includes(t.toLowerCase())) {
        return {
          verdict: "failed",
          reasonCode: "TEXT_NOT_FOUND",
          summary: `Expected text ${JSON.stringify(truncate(t, 80))} on page`,
        };
      }
    }
  }

  if (criteria.textAbsent !== undefined && criteria.textAbsent.length > 0) {
    for (const t of criteria.textAbsent) {
      if (hay.includes(t.toLowerCase())) {
        return {
          verdict: "failed",
          reasonCode: "TEXT_UNEXPECTED",
          summary: `Did not expect text ${JSON.stringify(truncate(t, 80))}`,
        };
      }
    }
  }

  if (criteria.structuredChecks !== undefined && criteria.structuredChecks.length > 0) {
    for (const check of criteria.structuredChecks) {
      const parsed = parseStructuredPath(check.path);
      if (!parsed) {
        return {
          verdict: "indeterminate",
          reasonCode: "STRUCTURED_PATH_UNKNOWN",
          summary: `Unsupported structured check path ${JSON.stringify(truncate(check.path, 120))}`,
        };
      }
      if (parsed.kind === "css") {
        const text = await page.locator(parsed.selector).first().innerText().catch(() => "");
        if (!structuredExpectOk(text, check.expect)) {
          return {
            verdict: "failed",
            reasonCode: "STRUCTURED_MISMATCH",
            summary: `Structured check ${check.id ?? parsed.selector} did not match expected value`,
          };
        }
      }
    }
  }

  if (criteria.judgeRubric !== undefined) {
    if (!options?.judgeModel) {
      return {
        verdict: "indeterminate",
        reasonCode: "JUDGE_NO_MODEL",
        summary: "judge_rubric present but model could not be resolved via Keys",
      };
    }
    const j = await runJudgeRubric(page, criteria, options.judgeModel);
    return j;
  }

  if (!hasAnyCriterion(criteria)) {
    return {
      verdict: "indeterminate",
      reasonCode: "NO_CRITERIA",
      summary: "No evaluable success criteria",
    };
  }

  return { verdict: "passed", reasonCode: "OK", summary: "All criteria satisfied" };
}

function hasAnyCriterion(c: SuccessCriteria): boolean {
  return (
    c.urlMatches != null ||
    (c.domSignals != null && c.domSignals.length > 0) ||
    (c.textPresent != null && c.textPresent.length > 0) ||
    (c.textAbsent != null && c.textAbsent.length > 0) ||
    (c.structuredChecks != null && c.structuredChecks.length > 0) ||
    c.judgeRubric != null
  );
}

function parseStructuredPath(path: string): { kind: "css"; selector: string } | null {
  if (path.startsWith("css:")) {
    return { kind: "css", selector: path.slice("css:".length).trim() };
  }
  return null;
}

function structuredExpectOk(text: string, expect?: unknown): boolean {
  if (expect === undefined) return text.trim().length > 0;
  return text.trim() === String(expect);
}

async function locatorCountSafe(loc: ReturnType<Page["locator"]>): Promise<number> {
  try {
    return await loc.count();
  } catch {
    return 0;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

const MAX_JUDGE_SAMPLE_CHARS = 8000;

async function sampleTextForJudge(page: Page, rubric: JudgeRubric): Promise<string> {
  if (rubric.contextSelector !== undefined && rubric.contextSelector.trim() !== "") {
    const t = await page.locator(rubric.contextSelector).first().innerText().catch(() => "");
    return truncate(t.trim(), MAX_JUDGE_SAMPLE_CHARS);
  }
  const mainText = await page.locator("main").first().innerText().catch(() => "");
  if (mainText.trim().length > 0) {
    return truncate(mainText.trim(), MAX_JUDGE_SAMPLE_CHARS);
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return truncate(bodyText.trim(), MAX_JUDGE_SAMPLE_CHARS);
}

function redactForLog(s: string): string {
  return s.replace(/\bBearer\s+[\w-_.]+\b/gi, "Bearer [redacted]").replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "sk-[redacted]");
}

async function runJudgeRubric(
  page: Page,
  criteria: SuccessCriteria,
  model: ResolvedModel,
): Promise<CriteriaEvaluation> {
  const rubric = criteria.judgeRubric;
  if (!rubric) {
    return { verdict: "passed", reasonCode: "OK", summary: "No rubric" };
  }

  const sample = await sampleTextForJudge(page, rubric);
  const base = model.providerBaseUrl?.replace(/\/?$/, "") ?? "https://api.openai.com/v1";
  const url = `${base}/chat/completions`;

  const system =
    'You are a test oracle. Reply with a single JSON object only: {"verdict":"pass"|"fail"|"uncertain"} matching whether the page satisfies the rubric.';
  const user = `Rubric id: ${rubric.id}\nSummary: ${rubric.summary ?? "(none)"}\n\nPage text:\n${sample}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${model.credentials.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 80,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        verdict: "indeterminate",
        reasonCode: "JUDGE_HTTP_ERROR",
        summary: `Judge request failed: HTTP ${res.status} ${truncate(redactForLog(t), 80)}`,
        judgeModelInvocations: 1,
      };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { verdict?: string };
    try {
      parsed = JSON.parse(raw) as { verdict?: string };
    } catch {
      return {
        verdict: "indeterminate",
        reasonCode: "JUDGE_PARSE_ERROR",
        summary: "Judge response was not valid JSON",
        judgeModelInvocations: 1,
      };
    }

    const v = (parsed.verdict ?? "").toLowerCase();
    if (v === "pass") {
      return {
        verdict: "passed",
        reasonCode: "JUDGE_PASS",
        summary: "Judge rubric passed",
        judgeModelInvocations: 1,
      };
    }
    if (v === "fail") {
      return {
        verdict: "failed",
        reasonCode: "JUDGE_FAIL",
        summary: "Judge rubric failed",
        judgeModelInvocations: 1,
      };
    }
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_UNCERTAIN",
      summary: "Judge returned uncertain",
      judgeModelInvocations: 1,
    };
  } catch (e) {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_ERROR",
      summary: `Judge error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
