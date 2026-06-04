export type BracketLogEntry = {
  tag: string;
  body: string;
  raw: string;
};

const BRACKET_LINE = /^\s*\[([^\]]+)\]\s*(.*)$/;

/** Format a worker log line with a bracket tag (SOPHIA ingest convention). */
export function formatBracketLogLine(tag: string, body: string): string {
  const t = tag.trim().toUpperCase();
  const b = body.trim();
  return b ? `[${t}] ${b}` : `[${t}]`;
}

/**
 * Pull recent worker lines that start with a `[TAG]` prefix.
 * Returns oldest-first within the tail window.
 */
export function extractRecentBracketTaggedLines(
  logLines: string[],
  maxLines = 100,
): BracketLogEntry[] {
  if (!Array.isArray(logLines) || logLines.length === 0) return [];
  const out: BracketLogEntry[] = [];
  const start = Math.max(0, logLines.length - 400);
  for (let i = start; i < logLines.length; i++) {
    const raw = logLines[i] ?? "";
    const m = raw.match(BRACKET_LINE);
    if (!m) continue;
    const tag = (m[1] ?? "").trim();
    if (!tag) continue;
    out.push({ tag, body: (m[2] ?? "").trim(), raw });
  }
  if (out.length <= maxLines) return out;
  return out.slice(-maxLines);
}
