import { describe, expect, it, vi } from "vitest";
import {
  buildResetStatements,
  executeAccountReset,
  ORPHAN_RISK_WORKSPACE_TABLES,
  RESET_CONFIRM_PHRASE,
} from "./account-reset";
import type { TxnClient } from "./db-adapter";

// ---------------------------------------------------------------------------
// SCOPING CORRECTNESS — the security-critical property: every statement is
// parameterised by the requesting account's workspace_id / user_id, and NEVER
// targets another account. These are pure-function tests (no DB).
// ---------------------------------------------------------------------------

const WS = "ws-OWNED-by-alice";
const UID = "user-alice";
const OTHER_WS = "ws-owned-by-mallory";

describe("buildResetStatements — account scope", () => {
  const stmts = buildResetStatements({ workspaceId: WS, userId: UID, scope: "account" });

  it("every statement carries an account-scoped predicate (workspace_id or user_id) — never a bare DELETE", () => {
    expect(stmts.length).toBeGreaterThan(0);
    for (const s of stmts) {
      expect(s.text).toMatch(/DELETE FROM \w+ WHERE /);
      // The predicate must reference workspace_id OR user_id OR (workspace) id.
      expect(s.text).toMatch(/workspace_id = \$1|user_id = \$1|WHERE id = \$1 AND owner_user_id = \$2/);
      // No statement may be unparameterised / target everything.
      expect(s.text).not.toMatch(/DELETE FROM \w+\s*;?\s*$/);
    }
  });

  it("only ever binds the requesting account's IDs — never another workspace", () => {
    const allParams = stmts.flatMap((s) => s.params);
    expect(allParams).toContain(WS);
    expect(allParams).toContain(UID);
    expect(allParams).not.toContain(OTHER_WS);
    for (const p of allParams) {
      expect([WS, UID]).toContain(p);
    }
  });

  it("explicitly deletes EVERY orphan-risk (no-cascade) table, scoped by workspace_id", () => {
    for (const table of ORPHAN_RISK_WORKSPACE_TABLES) {
      const stmt = stmts.find((s) => s.text === `DELETE FROM ${table} WHERE workspace_id = $1`);
      expect(stmt, `missing scoped delete for ${table}`).toBeDefined();
      expect(stmt!.params).toEqual([WS]);
    }
  });

  it("purges user-scoped cli_device_sessions by user_id", () => {
    const stmt = stmts.find((s) => s.text === "DELETE FROM cli_device_sessions WHERE user_id = $1");
    expect(stmt).toBeDefined();
    expect(stmt!.params).toEqual([UID]);
  });

  it("deletes the workspace LAST, guarded by owner_user_id (cross-account delete impossible)", () => {
    const last = stmts[stmts.length - 1];
    expect(last.text).toBe("DELETE FROM workspaces WHERE id = $1 AND owner_user_id = $2");
    expect(last.params).toEqual([WS, UID]);
  });

  it("does NOT touch the consent ledger by default (clean first-run must not drop consent)", () => {
    expect(stmts.some((s) => /email_preferences|email_send_log/.test(s.text))).toBe(false);
  });

  it("does NOT touch sidecar / global tables (restormel_testing_run_jobs, founders_*, catalog, models)", () => {
    const text = stmts.map((s) => s.text).join("\n");
    expect(text).not.toMatch(/restormel_testing_run_jobs/);
    expect(text).not.toMatch(/founders_/);
    expect(text).not.toMatch(/service_admin_emails/);
    expect(text).not.toMatch(/\bmodels\b/);
    expect(text).not.toMatch(/catalog_/);
    expect(text).not.toMatch(/provider_model_variants/);
  });
});

describe("buildResetStatements — Art 17 hard-erasure flag", () => {
  it("adds consent-ledger purge ONLY when eraseUserScopedData is set, scoped by user_id", () => {
    const stmts = buildResetStatements({
      workspaceId: WS,
      userId: UID,
      scope: "account",
      eraseUserScopedData: true,
    });
    const prefs = stmts.find((s) => s.text === "DELETE FROM email_preferences WHERE user_id = $1");
    expect(prefs).toBeDefined();
    expect(prefs!.params).toEqual([UID]);
    const sendLog = stmts.find((s) => /DELETE FROM email_send_log WHERE context_key IN/.test(s.text));
    expect(sendLog).toBeDefined();
    expect(sendLog!.params).toEqual([UID]);
  });
});

describe("buildResetStatements — project scope", () => {
  const PROJECT = "proj-123";
  const stmts = buildResetStatements({
    workspaceId: WS,
    userId: UID,
    scope: "project",
    projectId: PROJECT,
  });

  it("scopes log deletes by BOTH workspace_id AND project_id", () => {
    const req = stmts.find((s) => s.text.startsWith("DELETE FROM request_logs"));
    expect(req!.text).toBe("DELETE FROM request_logs WHERE workspace_id = $1 AND project_id = $2");
    expect(req!.params).toEqual([WS, PROJECT]);
  });

  it("deletes the project row guarded by workspace_id AND user_id (never another owner)", () => {
    const proj = stmts.find((s) => s.text.startsWith("DELETE FROM projects"));
    expect(proj!.text).toBe("DELETE FROM projects WHERE id = $1 AND workspace_id = $2 AND user_id = $3");
    expect(proj!.params).toEqual([PROJECT, WS, UID]);
  });

  it("does NOT delete the workspace itself (project scope keeps the account)", () => {
    expect(stmts.some((s) => s.text.startsWith("DELETE FROM workspaces"))).toBe(false);
  });

  it("throws if projectId missing for a project-scoped reset", () => {
    expect(() =>
      buildResetStatements({ workspaceId: WS, userId: UID, scope: "project" }),
    ).toThrow(/projectId required/);
  });
});

describe("buildResetStatements — guards", () => {
  it("requires workspaceId", () => {
    expect(() => buildResetStatements({ workspaceId: "", userId: UID, scope: "account" })).toThrow(
      /workspaceId required/,
    );
  });
  it("requires userId", () => {
    expect(() => buildResetStatements({ workspaceId: WS, userId: "", scope: "account" })).toThrow(
      /userId required/,
    );
  });
});

describe("executeAccountReset — runs every statement inside ONE transaction", () => {
  it("passes all built statements to sql.transaction and never executes outside it", async () => {
    const executed: { text: string; params: unknown[] }[] = [];
    const fakeTxn = {
      query: (text: string, params: unknown[]) => {
        executed.push({ text, params });
        return { text, params };
      },
    } as unknown as TxnClient;

    const transaction = vi.fn(async (fn: (txn: TxnClient) => unknown[]) => {
      fn(fakeTxn);
      return [] as unknown[][];
    });
    // Bare-template tagged client that must NEVER be called for deletes.
    const tagged = vi.fn();
    const sql = Object.assign(tagged, { transaction, query: vi.fn() });

    const built = buildResetStatements({ workspaceId: WS, userId: UID, scope: "account" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeAccountReset(sql as any, { workspaceId: WS, userId: UID, scope: "account" });

    expect(transaction).toHaveBeenCalledTimes(1);
    // Deletes only ran via the transaction's txn handle, not the bare client.
    expect(tagged).not.toHaveBeenCalled();
    expect(executed.length).toBe(built.length);
    // Every executed statement is account-scoped.
    for (const e of executed) {
      expect(e.params.every((p) => p === WS || p === UID)).toBe(true);
    }
    expect(result.clearedWorkspaceId).toBe(WS);
    expect(result.scope).toBe("account");
  });
});

describe("constants", () => {
  it("confirm phrase is stable", () => {
    expect(RESET_CONFIRM_PHRASE).toBe("reset my account");
  });
});
