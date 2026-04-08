import type { Page } from "playwright";
import type { AcSequencePostCheck } from "@restormel/testing-core";
import { isSafeHttpUrl } from "@restormel/testing-config";
import { runMissionExecutorCommand } from "./shell-hooks.js";

export type PostCheckResult =
  | { ok: true }
  | { ok: false; reasonCode: string; summary: string };

function resolveCheckUrl(raw: string, baseUrl: string): string | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return undefined;
  }
}

/**
 * R-BA-6 style checks after agent work: HTTP, DOM role+name, optional db shell.
 */
export async function runAcPostCheck(
  page: Page,
  check: AcSequencePostCheck,
  ctx: {
    baseUrl: string;
    hookCwd: string;
    extraEnv: Record<string, string | undefined>;
  },
): Promise<PostCheckResult> {
  if (check.http !== undefined) {
    const href = resolveCheckUrl(check.http.url, ctx.baseUrl);
    if (!href) {
      return { ok: false, reasonCode: "POST_CHECK_HTTP_BAD_URL", summary: "Invalid post_check http url" };
    }
    const urlCheck = isSafeHttpUrl(href);
    if (!urlCheck.ok) {
      return { ok: false, reasonCode: "POST_CHECK_HTTP_UNSAFE", summary: urlCheck.reason };
    }
    const method = (check.http.method ?? "GET").toUpperCase();
    const expectStatuses = check.http.expectStatus?.length ? check.http.expectStatus : [200];
    try {
      const res = await fetch(href, {
        method,
        headers: check.http.headers,
        body: method === "GET" || method === "HEAD" ? undefined : check.http.body,
      });
      if (!expectStatuses.includes(res.status)) {
        return {
          ok: false,
          reasonCode: "POST_CHECK_HTTP_STATUS",
          summary: `Expected status ${expectStatuses.join("|")}, got ${res.status} for ${href}`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        reasonCode: "POST_CHECK_HTTP_ERROR",
        summary: `HTTP check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (check.domRoleName !== undefined) {
    const { role, name, expectVisible = true } = check.domRoleName;
    const r = role.trim();
    if (r === "") {
      return { ok: false, reasonCode: "POST_CHECK_DOM_ROLE_EMPTY", summary: "dom_role_name.role is empty" };
    }
    try {
      const loc = page.getByRole(
        r as Parameters<Page["getByRole"]>[0],
        name ? { name: new RegExp(escapeRegExp(name), "i") } : undefined,
      );
      const n = await loc.count();
      if (n === 0) {
        return {
          ok: false,
          reasonCode: "POST_CHECK_DOM_ROLE_MISSING",
          summary: `No element role=${r}${name ? ` name~${JSON.stringify(name)}` : ""}`,
        };
      }
      if (expectVisible) {
        const vis = await loc.first().isVisible().catch(() => false);
        if (!vis) {
          return {
            ok: false,
            reasonCode: "POST_CHECK_DOM_ROLE_HIDDEN",
            summary: `role=${r} exists but not visible`,
          };
        }
      }
    } catch (e) {
      return {
        ok: false,
        reasonCode: "POST_CHECK_DOM_ERROR",
        summary: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (check.dbShell !== undefined && check.dbShell.trim() !== "") {
    const r = await runMissionExecutorCommand(check.dbShell.trim(), {
      cwd: ctx.hookCwd,
      label: `post_check db_shell (${check.acId})`,
      extraEnv: ctx.extraEnv,
    });
    if (!r.ok) {
      return { ok: false, reasonCode: "POST_CHECK_DB_SHELL_FAILED", summary: r.message };
    }
  }

  return { ok: true };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
