import type { Page } from "playwright";
import type { AcceptanceCriterionDefinition } from "@restormel/testing-core";
import type { ResolvedModel } from "@restormel/testing-keys-adapter";
import { postChatCompletions, type ChatMessage } from "./ac-llm.js";
import { normalizeEgressAllowHosts, resolveAgentNavigateUrl } from "./egress-navigation.js";
import type { SuiteLlmBudgetTracker } from "./suite-llm-budget.js";

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

async function pageSnippet(page: Page): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText().catch(() => "");
  return `URL: ${url}\nTitle: ${title}\nBody (truncated):\n${truncate(body.trim(), 6000)}`;
}

type AgentAction =
  | { action: "navigate"; url: string }
  | { action: "click_css"; selector: string }
  | { action: "click_role"; role: string; name?: string }
  | { action: "fill"; role: string; name?: string; value: string }
  | { action: "wait_load"; state?: "load" | "domcontentloaded" | "networkidle" }
  | { action: "scroll_into_view"; selector: string }
  | { action: "snapshot_a11y" }
  | { action: "done" }
  | { action: "give_up"; reason?: string };

function parseAgentAction(raw: string): AgentAction | undefined {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (o === null || typeof o !== "object") return undefined;
  const a = o as Record<string, unknown>;
  const action = typeof a.action === "string" ? a.action.toLowerCase() : "";
  if (action === "navigate" && typeof a.url === "string") return { action: "navigate", url: a.url };
  if (action === "click_css" && typeof a.selector === "string") return { action: "click_css", selector: a.selector };
  if (action === "click_role" && typeof a.role === "string")
    return { action: "click_role", role: a.role, name: typeof a.name === "string" ? a.name : undefined };
  if (action === "fill" && typeof a.role === "string" && typeof a.value === "string")
    return {
      action: "fill",
      role: a.role,
      name: typeof a.name === "string" ? a.name : undefined,
      value: a.value,
    };
  if (action === "wait_load")
    return {
      action: "wait_load",
      state:
        a.state === "domcontentloaded" || a.state === "networkidle" || a.state === "load"
          ? a.state
          : undefined,
    };
  if (action === "scroll_into_view" && typeof a.selector === "string")
    return { action: "scroll_into_view", selector: a.selector };
  if (action === "snapshot_a11y") return { action: "snapshot_a11y" };
  if (action === "done") return { action: "done" };
  if (action === "give_up") return { action: "give_up", reason: typeof a.reason === "string" ? a.reason : undefined };
  return undefined;
}

async function executeAction(
  page: Page,
  act: AgentAction,
  baseUrl: string,
  egressAllowHosts: string[] | undefined,
): Promise<{ ok: true } | { ok: false; err: string }> {
  const timeout = 15_000;
  try {
    if (act.action === "navigate") {
      const cur = page.url();
      const u =
        resolveAgentNavigateUrl(act.url, baseUrl, cur, egressAllowHosts) ??
        resolveAgentNavigateUrl(act.url, baseUrl, undefined, egressAllowHosts);
      if (!u) {
        return {
          ok: false,
          err: "navigate: URL not allowed (same-origin as base_url or egress_allow_hosts only)",
        };
      }
      await page.goto(u, { waitUntil: "load", timeout });
      return { ok: true };
    }
    if (act.action === "click_css") {
      await page.locator(act.selector).first().click({ timeout });
      return { ok: true };
    }
    if (act.action === "click_role") {
      const loc = page.getByRole(act.role as "button", act.name ? { name: new RegExp(escapeReg(act.name), "i") } : undefined);
      await loc.first().click({ timeout });
      return { ok: true };
    }
    if (act.action === "fill") {
      const loc = page.getByRole(act.role as "textbox", act.name ? { name: new RegExp(escapeReg(act.name), "i") } : undefined);
      await loc.first().fill(act.value, { timeout });
      return { ok: true };
    }
    if (act.action === "wait_load") {
      await page.waitForLoadState(act.state ?? "networkidle", { timeout });
      return { ok: true };
    }
    if (act.action === "scroll_into_view") {
      await page.locator(act.selector).first().scrollIntoViewIfNeeded({ timeout });
      return { ok: true };
    }
    return { ok: false, err: "unhandled action" };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sum of provider-reported tokens across AC agent chat completions in this loop (when APIs return `usage`). */
export type AcAgentAggregatedUsage = { promptTokens: number; completionTokens: number };

export type AcAgentLoopResult =
  | { ok: true; roundsUsed: number; finished: "done" | "max_rounds"; aggregatedTokenUsage?: AcAgentAggregatedUsage }
  | {
      ok: false;
      roundsUsed: number;
      reasonCode: string;
      summary: string;
      aggregatedTokenUsage?: AcAgentAggregatedUsage;
    };

/**
 * Multi-turn tool-use style loop: model proposes JSON actions until `done` / `give_up` / max rounds.
 */
export async function runBuiltInAcAgentLoop(
  page: Page,
  ac: AcceptanceCriterionDefinition,
  model: ResolvedModel,
  baseUrl: string,
  options?: {
    maxRounds?: number;
    instructions?: string;
    egressAllowHosts?: string[];
    suiteLlmBudget?: SuiteLlmBudgetTracker;
  },
): Promise<AcAgentLoopResult> {
  const maxRounds = options?.maxRounds ?? 12;
  const extra = options?.instructions?.trim() ? `\n${options.instructions.trim()}` : "";
  const egress = normalizeEgressAllowHosts(options?.egressAllowHosts);
  const egressNote =
    egress.length > 0
      ? ` Additional navigation is allowed to these hostnames (https): ${egress.join(", ")}.`
      : "";

  const system = `You are a browser automation agent. You must satisfy ONE acceptance criterion at a time using the page.
Output a single JSON object per message (no markdown). Allowed actions:
- {"action":"navigate","url":"<path or absolute URL on allowed host(s)>"}
- {"action":"click_css","selector":"<CSS selector>"}
- {"action":"click_role","role":"<aria role>","name":"<optional accessible name substring>"}
- {"action":"fill","role":"textbox","name":"<optional>","value":"<text>"}
- {"action":"wait_load","state":"networkidle"|"load"|"domcontentloaded"}
- {"action":"scroll_into_view","selector":"<CSS selector>"} to bring an element into view before clicking
- {"action":"snapshot_a11y"} to receive a fresh accessibility tree (ARIA) for the page — use when DOM text is ambiguous
- {"action":"done"} when the criterion is satisfied on the current page
- {"action":"give_up","reason":"..."} if blocked

Rules: stay on the same origin as the starting base URL${egressNote} Prefer role-based actions over fragile CSS. Never output secrets.${extra}`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Criterion id: ${ac.id}\nCriterion: ${ac.text}\n\n${await pageSnippet(page)}`,
    },
  ];

  let roundsUsed = 0;
  let promptAgg = 0;
  let completionAgg = 0;
  const bumpUsage = (u: { promptTokens?: number; completionTokens?: number } | undefined) => {
    promptAgg += u?.promptTokens ?? 0;
    completionAgg += u?.completionTokens ?? 0;
  };
  const agg = (): AcAgentAggregatedUsage | undefined =>
    promptAgg > 0 || completionAgg > 0 ? { promptTokens: promptAgg, completionTokens: completionAgg } : undefined;

  for (let i = 0; i < maxRounds; i++) {
    const block = options?.suiteLlmBudget?.tryConsumeLlm("ac_round");
    if (block) {
      return {
        ok: false,
        roundsUsed,
        reasonCode: block.code,
        summary: block.summary,
        aggregatedTokenUsage: agg(),
      };
    }
    roundsUsed++;
    const chat = await postChatCompletions(model, messages, { maxTokens: 400, temperature: 0 });
    options?.suiteLlmBudget?.recordLlmCall("ac_round", chat.usage);
    bumpUsage(chat.usage);
    if (!chat.ok) {
      return {
        ok: false,
        roundsUsed,
        reasonCode: "AC_AGENT_LLM_ERROR",
        summary: chat.summary,
        aggregatedTokenUsage: agg(),
      };
    }

    messages.push({ role: "assistant", content: chat.content });
    const act = parseAgentAction(chat.content);
    if (!act) {
      messages.push({
        role: "user",
        content: "Invalid JSON or unknown action. Reply with one JSON object only.",
      });
      continue;
    }

    if (act.action === "done") {
      return { ok: true, roundsUsed, finished: "done", aggregatedTokenUsage: agg() };
    }
    if (act.action === "give_up") {
      return {
        ok: false,
        roundsUsed,
        reasonCode: "AC_AGENT_GAVE_UP",
        summary: act.reason ?? "Agent gave up",
        aggregatedTokenUsage: agg(),
      };
    }

    if (act.action === "snapshot_a11y") {
      try {
        const snap = await page.locator("body").ariaSnapshot();
        const cap = 14_000;
        const text = snap.length <= cap ? snap : `${snap.slice(0, cap)}…`;
        messages.push({
          role: "user",
          content: `ARIA snapshot (Playwright ariaSnapshot, truncated if long):\n${text}`,
        });
      } catch (e) {
        messages.push({
          role: "user",
          content: `ARIA snapshot failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
      continue;
    }

    const ex = await executeAction(page, act, baseUrl, egress.length > 0 ? egress : undefined);
    if (!ex.ok) {
      messages.push({
        role: "user",
        content: `Action failed: ${ex.err}\n${await pageSnippet(page)}`,
      });
      continue;
    }

    messages.push({
      role: "user",
      content: `Action ok.\n${await pageSnippet(page)}`,
    });
  }

  return {
    ok: false,
    roundsUsed,
    reasonCode: "AC_AGENT_MAX_ROUNDS",
    summary: `Exceeded ${maxRounds} rounds without done`,
    aggregatedTokenUsage: agg(),
  };
}
