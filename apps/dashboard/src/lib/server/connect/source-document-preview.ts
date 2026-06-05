/**
 * Pre-check source URLs and text uploads for provenance metadata (no full parse/store).
 */
import {
  extractSourceMetadataFromHtml,
  runSourcePreScan,
  type SourceMetadata,
} from "@restormel/connect-core";
import type {
  ConnectSourceDocumentPreviewRequest,
  ConnectSourceDocumentPreviewResponse,
  ConnectSourceProvenance,
} from "@restormel/contracts/connect";
import { validateOutboundSurrealEndpoint } from "$lib/server/connect/outbound-surreal-endpoint";

const MAX_PREVIEW_FETCH_BYTES = 512_000;
const MAX_UPLOAD_PREVIEW_CHARS = 200_000;

function toProvenance(meta: SourceMetadata): ConnectSourceProvenance {
  return {
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.canonical_url ? { canonical_url: meta.canonical_url } : {}),
    ...(meta.url ? { url: meta.url } : {}),
    ...(meta.authors.length ? { authors: meta.authors } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    ...(meta.site_name ? { site_name: meta.site_name } : {}),
    ...(meta.published_at ? { published_at: meta.published_at } : {}),
  };
}

function suggestedName(meta: SourceMetadata, fallback: string): string {
  return (meta.title?.trim() || fallback).slice(0, 500);
}

async function fetchUrlHead(url: string): Promise<{ html: string; mime: string }> {
  const policy = validateOutboundSurrealEndpoint(url);
  if (!policy.ok) throw new Error(policy.message);

  const res = await fetch(url, {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5" },
  });
  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}).`);
  const mime = (res.headers.get("content-type") ?? "text/html").split(";")[0].trim();
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PREVIEW_FETCH_BYTES) {
    throw new Error("Page exceeds preview size limit (512KB). Import may still work with a smaller page.");
  }
  const html = new TextDecoder("utf-8").decode(buf);
  return { html, mime };
}

function decodeUploadPreview(input: ConnectSourceDocumentPreviewRequest): {
  text: string;
  mime: string;
  name: string;
} {
  const name = input.name?.trim() || "upload.txt";
  const mime = input.mime ?? "text/plain";
  if (input.content_encoding === "base64") {
    const bytes = Buffer.from(input.content ?? "", "base64");
    if (bytes.byteLength > MAX_PREVIEW_FETCH_BYTES) {
      throw new Error("Upload exceeds preview size limit.");
    }
    return { text: bytes.toString("utf8"), mime, name };
  }
  const text = input.content ?? "";
  if (text.length > MAX_UPLOAD_PREVIEW_CHARS) {
    throw new Error("Upload exceeds preview text limit.");
  }
  return { text, mime, name };
}

export async function previewSourceDocument(
  input: ConnectSourceDocumentPreviewRequest,
): Promise<ConnectSourceDocumentPreviewResponse | { ok: false; message: string }> {
  const warnings: string[] = [];

  if (input.kind === "url") {
    const url = input.url!.trim();
    try {
      const { html, mime } = await fetchUrlHead(url);
      const meta = extractSourceMetadataFromHtml(html, url);
      if (!meta.title) warnings.push("No title found in page metadata — you can set a display name before import.");
      const preScan = runSourcePreScan({ name: suggestedName(meta, url), mime, text: html, url });
      warnings.push(...preScan.warnings);
      if (preScan.blockers.includes("pdf_binary")) {
        return { ok: false, message: "PDF detected — configure a managed parser (LlamaParse, Unstructured) in Connections." };
      }
      return {
        ok: true,
        suggested_name: suggestedName(meta, (() => {
          try {
            const u = new URL(url);
            return u.pathname.split("/").filter(Boolean).pop() || u.hostname;
          } catch {
            return url.slice(0, 120);
          }
        })()),
        mime,
        provenance: toProvenance(meta),
        ...(warnings.length ? { warnings } : {}),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Preview failed.";
      return { ok: false, message };
    }
  }

  try {
    const { text, mime, name } = decodeUploadPreview(input);
    const isHtml = mime.includes("html") || /<html[\s>]/i.test(text);
    let meta: SourceMetadata;
    if (isHtml) {
      meta = extractSourceMetadataFromHtml(text, "https://upload.local/preview");
      meta.url = null;
      meta.canonical_url = null;
    } else {
      const firstLine = text.split(/\n/).find((l) => l.trim())?.trim() ?? "";
      meta = {
        title: firstLine.length > 10 && firstLine.length < 200 ? firstLine : null,
        canonical_url: null,
        url: null,
        authors: [],
        description: text.trim().slice(0, 400) || null,
        site_name: null,
        published_at: null,
      };
    }
    if (!isHtml) {
      warnings.push("Text upload — authors and publisher are not detected until you add them manually.");
    }
    if (mime.includes("pdf") || mime.includes("word")) {
      warnings.push("Binary formats need a managed parser on full import; metadata preview is limited.");
    }
    const preScan = runSourcePreScan({ name, mime, text });
    warnings.push(...preScan.warnings);
    if (preScan.blockers.includes("pdf_binary")) {
      return {
        ok: false,
        message: "PDF/binary upload — add LlamaParse or Unstructured via Connections before ingest.",
      };
    }
    return {
      ok: true,
      suggested_name: suggestedName(meta, name.replace(/\.[^.]+$/, "") || name),
      mime,
      provenance: toProvenance(meta),
      ...(warnings.length ? { warnings } : {}),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Preview failed.";
    return { ok: false, message };
  }
}
