import { isAbsolute, relative, resolve } from "node:path";

/**
 * True if `candidateAbs` is the same path or strictly inside `rootAbs` (no `..` escape).
 * Both paths should be absolute (e.g. from `path.resolve`).
 */
export function isPathContainedInRoot(rootAbs: string, candidateAbs: string): boolean {
  const rel = relative(rootAbs, candidateAbs);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export type ResolvePathUnderRootResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

/**
 * Resolve a user-supplied path against `root` and reject directory traversal outside `root`.
 */
export function resolvePathUnderRoot(root: string, userPath: string): ResolvePathUnderRootResult {
  const rootAbs = resolve(root);
  const candidateAbs = isAbsolute(userPath) ? resolve(userPath) : resolve(rootAbs, userPath);
  if (!isPathContainedInRoot(rootAbs, candidateAbs)) {
    return { ok: false, reason: `Path escapes allowed root (${rootAbs}): ${userPath}` };
  }
  return { ok: true, path: candidateAbs };
}

/** Single path segment safe for directory names (goal ids, etc.). */
export function sanitizePathSegment(segment: string, maxLen = 128): string {
  const s = segment.trim();
  if (s.length === 0) return "unnamed";
  if (/^[a-zA-Z0-9._-]+$/.test(s) && s.length <= maxLen) return s;
  const folded = s
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "");
  return folded.length > 0 ? folded : "segment";
}
