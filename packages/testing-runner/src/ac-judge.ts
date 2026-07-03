import type { Page } from "playwright";
import type { JudgeRubric } from "@restormel/testing-core";
import type { ResolvedModel } from "@restormel/testing-keys-adapter";
import { postChatCompletions } from "./ac-llm.js";
import type { CriteriaEvaluation } from "./evaluate-criteria.js";
import type { SuiteLlmBudgetTracker } from "./suite-llm-budget.js";

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

const MAX_SAMPLE = 8000;

async function sampleTextForAcJudge(page: Page, rubric: JudgeRubric): Promise<string> {
  if (rubric.contextSelector !== undefined && rubric.contextSelector.trim() !== "") {
    const t = await page.locator(rubric.contextSelector).first().innerText().catch(() => "");
    return truncate(t.trim(), MAX_SAMPLE);
  }
  const mainText = await page.locator("main").first().innerText().catch(() => "");
  if (mainText.trim().length > 0) return truncate(mainText.trim(), MAX_SAMPLE);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return truncate(bodyText.trim(), MAX_SAMPLE);
}

/**
 * Per-AC judge: response JSON must include matching `ac_id` (R-BA-5).
 */
export async function runAcShapedJudgeRubric(
  page: Page,
  rubric: JudgeRubric,
  model: ResolvedModel,
  ac: { id: string; text: string },
  options?: { suiteLlmBudget?: SuiteLlmBudgetTracker },
): Promise<CriteriaEvaluation> {
  const sample = await sampleTextForAcJudge(page, rubric);

  const system = `You are a test oracle for one acceptance criterion. Reply with a single JSON object only:
{"verdict":"pass"|"fail"|"uncertain","ac_id":"<string>","reason":"<short>"}
The ac_id field MUST exactly equal the acceptance criterion id provided in the user message.`;

  const user = `Acceptance criterion id: ${ac.id}
Criterion text: ${ac.text}

Rubric id: ${rubric.id}
Rubric summary: ${rubric.summary ?? "(none)"}

Page text:
${sample}`;

  const block = options?.suiteLlmBudget?.tryConsumeLlm("chat");
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
    { maxTokens: 120, temperature: 0, responseFormat: "json_object" },
  );
  options?.suiteLlmBudget?.recordLlmCall("chat", chat.usage);

  const usageFields: Pick<CriteriaEvaluation, "judgePromptTokens" | "judgeCompletionTokens"> = {};
  if (chat.usage?.promptTokens !== undefined) usageFields.judgePromptTokens = chat.usage.promptTokens;
  if (chat.usage?.completionTokens !== undefined) usageFields.judgeCompletionTokens = chat.usage.completionTokens;

  if (!chat.ok) {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_HTTP_ERROR",
      summary: `AC judge HTTP error: ${chat.summary}`,
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }

  let parsed: { verdict?: string; ac_id?: string; reason?: string };
  try {
    parsed = JSON.parse(chat.content) as { verdict?: string; ac_id?: string; reason?: string };
  } catch {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_PARSE_ERROR",
      summary: "AC judge response was not valid JSON",
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }

  if (parsed.ac_id !== ac.id) {
    return {
      verdict: "indeterminate",
      reasonCode: "JUDGE_AC_ID_MISMATCH",
      summary: `Model ac_id ${JSON.stringify(parsed.ac_id)} did not match expected ${JSON.stringify(ac.id)}`,
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }

  const v = (parsed.verdict ?? "").toLowerCase();
  const reason = parsed.reason ? `: ${parsed.reason}` : "";
  if (v === "pass") {
    return {
      verdict: "passed",
      reasonCode: "JUDGE_AC_PASS",
      summary: `AC judge passed${reason}`,
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }
  if (v === "fail") {
    return {
      verdict: "failed",
      reasonCode: "JUDGE_AC_FAIL",
      summary: `AC judge failed${reason}`,
      judgeModelInvocations: 1,
      ...usageFields,
    };
  }
  return {
    verdict: "indeterminate",
    reasonCode: "JUDGE_AC_UNCERTAIN",
    summary: `AC judge uncertain${reason}`,
    judgeModelInvocations: 1,
    ...usageFields,
  };
}
