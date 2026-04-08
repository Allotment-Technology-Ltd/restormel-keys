export type PostRunsBody = {
  suite_id: string;
  environment_id?: string;
  target_url?: string;
  commit_sha?: string;
  repository?: string;
  pr_number?: string;
  config_path?: string;
  goal_ids?: string[];
};

export function parsePostRunsBody(raw: unknown): { ok: true; body: PostRunsBody } | { ok: false; message: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, message: "JSON body must be an object" };
  }
  const o = raw as Record<string, unknown>;
  const suiteId = o.suite_id;
  if (typeof suiteId !== "string" || suiteId.trim() === "") {
    return { ok: false, message: "suite_id is required (non-empty string)" };
  }
  const body: PostRunsBody = { suite_id: suiteId.trim() };
  if (typeof o.environment_id === "string" && o.environment_id.trim() !== "") {
    body.environment_id = o.environment_id.trim();
  }
  if (typeof o.target_url === "string" && o.target_url.trim() !== "") {
    body.target_url = o.target_url.trim();
  }
  if (typeof o.commit_sha === "string" && o.commit_sha.trim() !== "") {
    body.commit_sha = o.commit_sha.trim();
  }
  if (typeof o.repository === "string" && o.repository.trim() !== "") {
    body.repository = o.repository.trim();
  }
  if (typeof o.pr_number === "string" && o.pr_number.trim() !== "") {
    body.pr_number = o.pr_number.trim();
  }
  if (typeof o.config_path === "string" && o.config_path.trim() !== "") {
    body.config_path = o.config_path.trim();
  }
  if (o.goal_ids !== undefined) {
    if (!Array.isArray(o.goal_ids)) {
      return { ok: false, message: "goal_ids must be an array of strings when present" };
    }
    const ids: string[] = [];
    for (let i = 0; i < o.goal_ids.length; i++) {
      const g = o.goal_ids[i];
      if (typeof g !== "string" || g.trim() === "") {
        return { ok: false, message: `goal_ids[${i}] must be a non-empty string` };
      }
      ids.push(g.trim());
    }
    body.goal_ids = ids;
  }
  return { ok: true, body };
}
