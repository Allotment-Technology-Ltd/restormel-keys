import type { Page } from "playwright";
import type { JudgeRubric, SuccessCriteria, Verdict } from "@restormel/testing-core";
import type { ResolvedModel } from "@restormel/testing-keys-adapter";
import { postChatCompletions } from "./ac-llm.js";
import { evaluateLighthouseStructuredCheck, parseLighthouseStructuredPath } from "./lighthouse-structured-check.js";
import type { SuiteLlmBudgetTracker } from "./suite-llm-budget.js";

export interface CriteriaEvaluation {
  verdict: Verdict;
  reasonCode: string;
  summary: string;
  /** Set when an OpenAI-compatible judge request was sent (for Keys model meta). */
  judgeModelInvocations?: number;
  /** Provider-reported tokens from the judge completion, when present. */
  judgePromptTokens?: number;
  judgeCompletionTokens?: number;
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
    suiteLlmBudget?: SuiteLlmBudgetTracker;
  },
): Promise<CriteriaEvaluation> {
  if (criteria.anyOf !== undefined && criteria.anyOf.length > 0) {
    const failures: CriteriaEvaluation[] = [];
    for (let i = 0; i < criteria.anyOf.length; i++) {
      const branch = criteria.anyOf[i]!;
      const r = await evaluateBrowserSuccessCriteria(page, branch, options);
      if (r.verdict === "passed") {
        return {
          verdict: "passed",
          reasonCode: "ANY_OF_BRANCH_PASSED",
          summary: `any_of: branch ${i + 1} satisfied (${r.reasonCode})`,
        };
      }
      failures.push(r);
    }
    if (failures.every((f) => f.verdict === "failed")) {
      return {
        verdict: "failed",
        reasonCode: "ANY_OF_ALL_FAILED",
        summary: `any_of: all ${failures.length} branches failed`,
      };
    }
    return {
      verdict: "indeterminate",
      reasonCode: "ANY_OF_NONE_PASSED",
      summary: `any_of: no branch passed (${failures.map((f) => f.reasonCode).join(", ")})`,
    };
  }

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
      const vit = await evaluateVitalOrCssCheck(page, check);
      if (vit) return vit;
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
    const j = await runJudgeRubric(page, criteria, options.judgeModel, options.suiteLlmBudget);
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
    (c.anyOf != null && c.anyOf.length > 0) ||
    c.urlMatches != null ||
    (c.domSignals != null && c.domSignals.length > 0) ||
    (c.textPresent != null && c.textPresent.length > 0) ||
    (c.textAbsent != null && c.textAbsent.length > 0) ||
    (c.structuredChecks != null && c.structuredChecks.length > 0) ||
    c.judgeRubric != null
  );
}

async function evaluateVitalOrCssCheck(page: Page, check: { path: string; id?: string; expect?: unknown }): Promise<CriteriaEvaluation | null> {
  const path = check.path.trim();
  const vital = parseVitalPath(path);
  if (vital) {
    return evaluateVitalCheck(page, vital, check);
  }
  const pl = path.toLowerCase();
  const lhCats = parseLighthouseStructuredPath(path);
  if (lhCats !== null) {
    return evaluateLighthouseStructuredCheck(page.url(), check, lhCats);
  }
  if (pl.startsWith("lighthouse:") || pl.startsWith("lh:")) {
    return {
      verdict: "indeterminate",
      reasonCode: "LIGHTHOUSE_PATH_UNKNOWN",
      summary: `Unknown Lighthouse structured check path ${JSON.stringify(truncate(check.path, 120))}`,
    };
  }
  const parsed = parseStructuredPath(path);
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
  return null;
}

type VitalKind = "lcp" | "fcp" | "cls";

function parseVitalPath(path: string): VitalKind | null {
  const p = path.toLowerCase();
  if (p === "vital:lcp" || p === "web_vitals:lcp") return "lcp";
  if (p === "vital:fcp" || p === "web_vitals:fcp") return "fcp";
  if (p === "vital:cls" || p === "web_vitals:cls") return "cls";
  return null;
}

async function evaluateVitalCheck(
  page: Page,
  kind: VitalKind,
  check: { id?: string; expect?: unknown },
): Promise<CriteriaEvaluation> {
  const maxMs =
    typeof check.expect === "number" && Number.isFinite(check.expect) ? check.expect : kind === "cls" ? 0.1 : 2500;
  const label = check.id ?? `vital:${kind}`;

  try {
    if (kind === "lcp") {
      const ms = await page.evaluate(() => {
        const entries = (
          performance.getEntriesByType as (t: string) => Array<{
            startTime: number;
            renderTime?: number;
            loadTime?: number;
          }>
        )("largest-contentful-paint");
        const last = entries[entries.length - 1];
        if (!last) return null;
        const t = last.renderTime ?? last.loadTime ?? last.startTime;
        return typeof t === "number" && t > 0 ? t : null;
      });
      if (ms == null) {
        return {
          verdict: "indeterminate",
          reasonCode: "VITAL_LCP_MISSING",
          summary: `${label}: no LCP entry (try waiting for load)`,
        };
      }
      if (ms > maxMs) {
        return {
          verdict: "failed",
          reasonCode: "VITAL_LCP_SLOW",
          summary: `${label}: LCP ${Math.round(ms)}ms exceeds max ${maxMs}ms`,
        };
      }
      return { verdict: "passed", reasonCode: "VITAL_LCP_OK", summary: `${label}: LCP ${Math.round(ms)}ms` };
    }

    if (kind === "fcp") {
      const ms = await page.evaluate(() => {
        const entries = performance.getEntriesByName("first-contentful-paint");
        const e = entries[0];
        return e && typeof e.startTime === "number" ? e.startTime : null;
      });
      if (ms == null) {
        return {
          verdict: "indeterminate",
          reasonCode: "VITAL_FCP_MISSING",
          summary: `${label}: no FCP entry`,
        };
      }
      if (ms > maxMs) {
        return {
          verdict: "failed",
          reasonCode: "VITAL_FCP_SLOW",
          summary: `${label}: FCP ${Math.round(ms)}ms exceeds max ${maxMs}ms`,
        };
      }
      return { verdict: "passed", reasonCode: "VITAL_FCP_OK", summary: `${label}: FCP ${Math.round(ms)}ms` };
    }

    const cls = await page.evaluate(() => {
      const entries = (performance.getEntriesByType as (t: string) => Array<{ value?: number; hadRecentInput?: boolean }>)(
        "layout-shift",
      );
      let score = 0;
      for (const e of entries) {
        if (e.hadRecentInput === true) continue;
        score += e.value ?? 0;
      }
      return score;
    });
    if (cls > maxMs) {
      return {
        verdict: "failed",
        reasonCode: "VITAL_CLS_HIGH",
        summary: `${label}: CLS ${cls.toFixed(3)} exceeds max ${maxMs}`,
      };
    }
    return { verdict: "passed", reasonCode: "VITAL_CLS_OK", summary: `${label}: CLS ${cls.toFixed(3)}` };
  } catch (e) {
    return {
      verdict: "indeterminate",
      reasonCode: "VITAL_EVAL_ERROR",
      summary: `${label}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
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

function judgeUsageFields(usage: { promptTokens?: number; completionTokens?: number } | undefined): Pick<
  CriteriaEvaluation,
  "judgePromptTokens" | "judgeCompletionTokens"
> {
  const out: Pick<CriteriaEvaluation, "judgePromptTokens" | "judgeCompletionTokens"> = {};
  if (usage?.promptTokens !== undefined) out.judgePromptTokens = usage.promptTokens;
  if (usage?.completionTokens !== undefined) out.judgeCompletionTokens = usage.completionTokens;
  return out;
}

async function runJudgeRubric(
  page: Page,
  criteria: SuccessCriteria,
  model: ResolvedModel,
  suiteLlmBudget?: SuiteLlmBudgetTracker,
): Promise<CriteriaEvaluation> {
  const rubric = criteria.judgeRubric;
  if (!rubric) {
    return { verdict: "passed", reasonCode: "OK", summary: "No rubric" };
  }

  const sample = await sampleTextForJudge(page, rubric);

  const system =
    'You are a test oracle. Reply with a single JSON object only: {"verdict":"pass"|"fail"|"uncertain"} matching whether the page satisfies the rubric.';
  const user = `Rubric id: ${rubric.id}\nSummary: ${rubric.summary ?? "(none)"}\n\nPage text:\n${sample}`;

  const block = suiteLlmBudget?.tryConsumeLlm("chat");
  if (block) {
    return {
      verdict: "failed",
      reasonCode: block.code,
      summary: block.summary,
      judgeModelInvocations: 0,
    };
  }

  const chat = await postChatCompletions(
    model,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 80, temperature: 0, responseFormat: "json_object" },
  );
  suiteLlmBudget?.recordLlmCall("chat", chat.usage);
  const usageFields = judgeUsageFields(chat.usage);

  if (!chat.ok) {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_HTTP_ERROR",
      summary: `Judge request failed: ${chat.summary}`,
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }

  let parsed: { verdict?: string };
  try {
    parsed = JSON.parse(chat.content) as { verdict?: string };
  } catch {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_PARSE_ERROR",
      summary: "Judge response was not valid JSON",
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }

  const v = (parsed.verdict ?? "").toLowerCase();
  if (v === "pass") {
    return {
      verdict: "passed",
      reasonCode: "JUDGE_PASS",
      summary: "Judge rubric passed",
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }
  if (v === "fail") {
    return {
      verdict: "failed",
      reasonCode: "JUDGE_FAIL",
      summary: "Judge rubric failed",
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }
  return {
    verdict: "indeterminate",
    reasonCode: "JUDGE_UNCERTAIN",
    summary: "Judge returned uncertain",
    judgeModelInvocations: 1,
    ...usageFields,
  };
}
