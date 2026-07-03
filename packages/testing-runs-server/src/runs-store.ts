import { randomUUID } from "node:crypto";

export type RunEntityStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "indeterminate"
  | "error";

export interface RunEntity {
  id: string;
  status: RunEntityStatus;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  suite_id: string;
  /** Runner workspace root (audit / ops; not a secret). */
  workspace_root?: string;
  goal_completed?: number;
  goal_total?: number;
  verdict?: string;
  summary?: string;
  error_message?: string;
  artifact_dir?: string;
}

export interface RunsStore {
  readonly kind: "memory" | "neon";
  createQueued(suiteId: string, workspaceRoot: string): Promise<RunEntity>;
  get(id: string): Promise<RunEntity | undefined>;
  patch(id: string, partial: Partial<RunEntity>): Promise<void>;
  list(params: { limit: number; offset: number }): Promise<{ items: RunEntity[]; next_offset: number | null }>;
  ping?(): Promise<void>;
}

export class InMemoryRunsStore implements RunsStore {
  readonly kind = "memory" as const;
  private readonly byId = new Map<string, RunEntity>();

  async createQueued(suiteId: string, workspaceRoot: string): Promise<RunEntity> {
    const id = randomUUID();
    const row: RunEntity = {
      id,
      status: "queued",
      created_at: new Date().toISOString(),
      suite_id: suiteId,
      workspace_root: workspaceRoot,
    };
    this.byId.set(id, row);
    return row;
  }

  async get(id: string): Promise<RunEntity | undefined> {
    return this.byId.get(id);
  }

  async patch(id: string, partial: Partial<RunEntity>): Promise<void> {
    const cur = this.byId.get(id);
    if (!cur) return;
    this.byId.set(id, { ...cur, ...partial });
  }

  async list(params: { limit: number; offset: number }): Promise<{ items: RunEntity[]; next_offset: number | null }> {
    const sorted = [...this.byId.values()].sort((a, b) => {
      const t = b.created_at.localeCompare(a.created_at);
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });
    const slice = sorted.slice(params.offset, params.offset + params.limit);
    const next_offset =
      params.offset + slice.length < sorted.length ? params.offset + params.limit : null;
    return { items: slice, next_offset };
  }
}
