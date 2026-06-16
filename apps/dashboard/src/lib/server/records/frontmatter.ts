// Synced from scripts/records/lib.mjs (REC-PLAN-005). Vendored locally because the shared repo-root script escapes the SvelteKit app root and vite build/Rollup cannot bundle it. Keep in sync.

// Minimal YAML front-matter reader for flat key: value (+ inline [a, b] lists).
export function parseFrontMatter(content: string): Record<string, string | string[]> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!m) return null;
  const data: Record<string, string | string[]> = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val: string | string[] = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(val)) val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    else val = val.replace(/^["']|["']$/g, "");
    data[key] = val;
  }
  return data;
}
