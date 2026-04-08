import type { Page } from "playwright";
import type { AcceptanceCriterionDefinition } from "@restormel/testing-core";
import type { ResolvedModel } from "@restormel/testing-keys-adapter";
import { postChatCompletions, type ChatMessage } from "./ac-llm.js";

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

async function pageSnippet(page: Page): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText().catch(() => "");
  return `URL: ${url}\nTitle: ${title}\nBody (truncated):\n${truncate(body.trim(), 6000)}`;
}

function resolveNavUrl(href: string, baseUrl: string): string | null {
  try {
    const b = new URL(baseUrl);
    const t = new URL(href.trim(), b);
    if (t.origin !== b.origin) return null;
    return t.href;
  } catch {
    return null;
  }
}

type AgentAction =
  | { action: "navigate"; url: string }
  | { action: "click_css"; selector: string }
  | { action: "click_role"; role: string; name?: string }
  | { action: "fill"; role: string; name?: string; value: string }
  | { action: "wait_load"; state?: "load" | "domcontentloaded" | "networkidle" }
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
  if (action === "done") return { action: "done" };
  if (action === "give_up") return { action: "give_up", reason: typeof a.reason === "string" ? a.reason : undefined };
  return undefined;
}

async function executeAction(page: Page, act: AgentAction, baseUrl: string): Promise<{ ok: true } | { ok: false; err: string }> {
  const timeout = 15_000;
  try {
    if (act.action === "navigate") {
      const u = resolveNavUrl(act.url, baseUrl) ?? resolveNavUrl(act.url, page.url());
      if (!u) return { ok: false, err: "navigate: URL not allowed (same-origin only)" };
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
    return { ok: false, err: "unhandled action" };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type AcAgentLoopResult =
  | { ok: true; roundsUsed: number; finished: "done" | "max_rounds" }
  | { ok: false; roundsUsed: number; reasonCode: string; summary: string };

/**
 * Multi-turn tool-use style loop: model proposes JSON actions until `done` / `give_up` / max rounds.
 */
export async function runBuiltInAcAgentLoop(
  page: Page,
  ac: AcceptanceCriterionDefinition,
  model: ResolvedModel,
  baseUrl: string,
  options?: { maxRounds?: number; instructions?: string },
): Promise<AcAgentLoopResult> {
  const maxRounds = options?.maxRounds ?? 12;
  const extra = options?.instructions?.trim() ? `\n${options.instructions.trim()}` : "";

  const system = `You are a browser automation agent. You must satisfy ONE acceptance criterion at a time using the page.
Output a single JSON object per message (no markdown). Allowed actions:
- {"action":"navigate","url":"<path or absolute same-origin URL>"}
- {"action":"click_css","selector":"<CSS selector>"}
- {"action":"click_role","role":"<aria role>","name":"<optional accessible name substring>"}
- {"action":"fill","role":"textbox","name":"<optional>","value":"<text>"}
- {"action":"wait_load","state":"networkidle"|"load"|"domcontentloaded"}
- {"action":"done"} when the criterion is satisfied on the current page
- {"action":"give_up","reason":"..."} if blocked

Rules: stay on the same origin as the starting base URL. Prefer role-based actions over fragile CSS. Never output secrets.${extra}`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Criterion id: ${ac.id}\nCriterion: ${ac.text}\n\n${await pageSnippet(page)}`,
    },
  ];

  let roundsUsed = 0;
  for (let i = 0; i < maxRounds; i++) {
    roundsUsed++;
    const chat = await postChatCompletions(model, messages, { maxTokens: 400, temperature: 0 });
    if (!chat.ok) {
      return {
        ok: false,
        roundsUsed,
        reasonCode: "AC_AGENT_LLM_ERROR",
        summary: chat.summary,
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
      return { ok: true, roundsUsed, finished: "done" };
    }
    if (act.action === "give_up") {
      return {
        ok: false,
        roundsUsed,
        reasonCode: "AC_AGENT_GAVE_UP",
        summary: act.reason ?? "Agent gave up",
      };
    }

    const ex = await executeAction(page, act, baseUrl);
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
  };
}
