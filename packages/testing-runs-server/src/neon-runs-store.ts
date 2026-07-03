import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { RunEntity, RunEntityStatus, RunsStore } from "./runs-store.js";

function asIso(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function asNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return undefined;
}

function rowToEntity(r: Record<string, unknown>): RunEntity | undefined {
  const id = r.id;
  const status = r.status;
  const suite_id = r.suite_id;
  const created_at = asIso(r.created_at);
  if (typeof id !== "string" || typeof status !== "string" || typeof suite_id !== "string" || !created_at) {
    return undefined;
  }
  const e: RunEntity = {
    id,
    status: status as RunEntityStatus,
    created_at,
    suite_id,
  };
  const ws = r.workspace_root;
  if (typeof ws === "string") e.workspace_root = ws;
  const st = asIso(r.started_at);
  if (st !== undefined) e.started_at = st;
  const en = asIso(r.ended_at);
  if (en !== undefined) e.ended_at = en;
  const gc = asNum(r.goal_completed);
  if (gc !== undefined) e.goal_completed = gc;
  const gt = asNum(r.goal_total);
  if (gt !== undefined) e.goal_total = gt;
  if (typeof r.verdict === "string") e.verdict = r.verdict;
  if (typeof r.summary === "string") e.summary = r.summary;
  if (typeof r.error_message === "string") e.error_message = r.error_message;
  if (typeof r.artifact_dir === "string") e.artifact_dir = r.artifact_dir;
  return e;
}

/**
 * Postgres persistence via Neon serverless driver (same stack as the Restormel dashboard).
 * Requires migration `027_restormel_testing_run_jobs.sql` applied on the target branch.
 */
export class NeonRunsStore implements RunsStore {
  readonly kind = "neon" as const;
  private readonly sql: ReturnType<typeof neon>;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  async ping(): Promise<void> {
    await this.sql`SELECT 1 AS ok`;
  }

  async createQueued(suiteId: string, workspaceRoot: string): Promise<RunEntity> {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    await this.sql`
      INSERT INTO restormel_testing_run_jobs (
        id, status, suite_id, workspace_root, created_at
      ) VALUES (
        ${id}, ${"queued"}, ${suiteId}, ${workspaceRoot}, ${created_at}
      )
    `;
    return {
      id,
      status: "queued",
      created_at,
      suite_id: suiteId,
      workspace_root: workspaceRoot,
    };
  }

  async get(id: string): Promise<RunEntity | undefined> {
    const rows = (await this.sql`
      SELECT * FROM restormel_testing_run_jobs WHERE id = ${id} LIMIT 1
    `) as Record<string, unknown>[];
    const r = rows[0];
    if (!r) return undefined;
    return rowToEntity(r);
  }

  async patch(id: string, partial: Partial<RunEntity>): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    const m: RunEntity = { ...cur, ...partial };
    const ws = m.workspace_root ?? cur.workspace_root;
    await this.sql`
      UPDATE restormel_testing_run_jobs SET
        status = ${m.status},
        suite_id = ${m.suite_id},
        workspace_root = ${ws ?? ""},
        created_at = ${m.created_at},
        started_at = ${m.started_at ?? null},
        ended_at = ${m.ended_at ?? null},
        goal_completed = ${m.goal_completed ?? null},
        goal_total = ${m.goal_total ?? null},
        verdict = ${m.verdict ?? null},
        summary = ${m.summary ?? null},
        error_message = ${m.error_message ?? null},
        artifact_dir = ${m.artifact_dir ?? null},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  async list(params: { limit: number; offset: number }): Promise<{ items: RunEntity[]; next_offset: number | null }> {
    const lim = Math.min(Math.max(1, params.limit), 100);
    const off = Math.max(0, params.offset);
    const rows = (await this.sql`
      SELECT * FROM restormel_testing_run_jobs
      ORDER BY created_at DESC, id DESC
      LIMIT ${lim} OFFSET ${off}
    `) as Record<string, unknown>[];
    const items: RunEntity[] = [];
    for (const row of rows) {
      const e = rowToEntity(row);
      if (e) items.push(e);
    }
    if (rows.length < lim) {
      return { items, next_offset: null };
    }
    return { items, next_offset: off + lim };
  }
}
