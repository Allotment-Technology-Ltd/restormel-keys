import type { CoreMessage } from "ai";

export type SupportChatInputMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 8000;

/**
 * Sanitize client-supplied messages: only user/assistant, bounded length and count.
 */
export function parseSupportMessages(raw: unknown): CoreMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CoreMessage[] = [];
  for (const item of raw) {
    if (out.length >= MAX_MESSAGES) break;
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_CONTENT_LEN) continue;
    out.push({ role, content: trimmed });
  }
  if (out.length === 0) return null;
  return out;
}
