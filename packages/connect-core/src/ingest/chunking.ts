/**
 * Structure-aware chunking that preserves complete units instead of naive
 * fixed-size slicing. Research consistently shows structure/paragraph-aware
 * chunking beats fixed-size, which fragments coherent content. The philosophy
 * lesson applies to every domain: keep whole ideas/arguments together.
 */
import type { ConnectChunkingProfile } from "@restormel/contracts/connect";
import type { DocChunk } from "./ingest-ports.js";

const DEFAULT_PROFILE: ConnectChunkingProfile = {
  strategy: "structure_aware",
  min_chars: 400,
  max_chars: 4000,
  overlap_chars: 0,
};

/** Split markdown into structural blocks (headings + paragraphs), order preserved. */
function splitBlocks(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: string[] = [];
  for (const raw of normalized.split(/\n{2,}/)) {
    const para = raw.trim();
    if (!para) continue;
    // Headings start a new block boundary; keep them attached to their own text.
    blocks.push(para);
  }
  return blocks;
}

/** Last `overlap` chars of a chunk, trimmed to start on a word boundary. */
function overlapTail(text: string, overlap: number): string {
  if (overlap <= 0) return "";
  if (text.length <= overlap) return text;
  const raw = text.slice(-overlap);
  const ws = raw.search(/\s/);
  return ws >= 0 ? raw.slice(ws + 1).trimStart() : raw;
}

/** Naive sentence splitter (no lookbehind, ES2019-safe). */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?\n]+[.!?]*\s*/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text.trim()];
}

/** Hard-split an oversized block into <= max_chars pieces along sentence bounds. */
function splitOversized(block: string, maxChars: number): string[] {
  if (block.length <= maxChars) return [block];
  const out: string[] = [];
  let cur = "";
  for (const sentence of splitSentences(block)) {
    if (sentence.length > maxChars) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      // Sentence longer than max: slice by characters as a last resort.
      for (let i = 0; i < sentence.length; i += maxChars) {
        out.push(sentence.slice(i, i + maxChars));
      }
      continue;
    }
    if ((cur + " " + sentence).trim().length > maxChars) {
      if (cur) out.push(cur);
      cur = sentence;
    } else {
      cur = cur ? `${cur} ${sentence}` : sentence;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function fixedChunks(markdown: string, profile: ConnectChunkingProfile): DocChunk[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  const max = profile.max_chars;
  const overlap = Math.min(profile.overlap_chars, Math.floor(max / 2));
  const step = Math.max(1, max - overlap);
  const chunks: DocChunk[] = [];
  let index = 0;
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + max).trim();
    if (slice) chunks.push({ index: index++, text: slice });
    if (i + max >= text.length) break;
  }
  return chunks;
}

/**
 * Chunk a document's markdown into complete-unit chunks.
 * structure_aware/recursive/semantic all pack structural blocks up to max_chars
 * (semantic falls back to structural packing here; true embedding-based semantic
 * segmentation can be layered later). `fixed` is the naive baseline.
 */
export function chunkDocument(
  markdown: string,
  profile: ConnectChunkingProfile = DEFAULT_PROFILE,
): DocChunk[] {
  if (!markdown.trim()) return [];
  if (profile.strategy === "fixed") return fixedChunks(markdown, profile);

  const blocks = splitBlocks(markdown);
  const chunks: DocChunk[] = [];
  let index = 0;
  let buffer = "";

  const flush = () => {
    const text = buffer.trim();
    if (text) chunks.push({ index: index++, text });
    buffer = "";
  };

  for (const block of blocks) {
    const pieces = splitOversized(block, profile.max_chars);
    for (const piece of pieces) {
      const candidate = buffer ? `${buffer}\n\n${piece}` : piece;
      if (candidate.length > profile.max_chars && buffer) {
        flush();
        buffer = piece;
      } else {
        buffer = candidate;
      }
      // Flush when comfortably above min to keep units whole but bounded.
      if (buffer.length >= profile.max_chars) flush();
    }
  }
  flush();

  // Merge a too-small trailing chunk back into the previous one.
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (last.text.length < profile.min_chars) {
      const prev = chunks[chunks.length - 2];
      if (prev.text.length + last.text.length <= profile.max_chars) {
        prev.text = `${prev.text}\n\n${last.text}`;
        chunks.pop();
      }
    }
  }

  // Carry the previous chunk's tail across each boundary so cross-boundary
  // relations stay extractable. Applied after packing/merging (backwards, so
  // every tail comes from the neighbor's own text, not an earlier carry);
  // chunks may exceed max_chars by up to the (capped) overlap.
  const overlap = Math.min(profile.overlap_chars, Math.floor(profile.max_chars / 2));
  if (overlap > 0) {
    for (let i = chunks.length - 1; i >= 1; i--) {
      const tail = overlapTail(chunks[i - 1].text, overlap);
      if (tail) chunks[i].text = `${tail}\n\n${chunks[i].text}`;
    }
  }

  return chunks;
}
