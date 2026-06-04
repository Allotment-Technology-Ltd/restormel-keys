/**
 * Google Drive source connector (REST via fetch, bound to an access token).
 * Google-native docs are exported to text; binary files download as-is.
 */
import type { SourceConnector, SourceDocRef, FetchedDocument } from "@restormel/connect-core";

const GOOGLE_DOC_EXPORTS: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: "txt" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: "csv" },
};

export function buildGoogleDriveConnector(accessToken: string): SourceConnector {
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    provider: "google_drive",
    async list(opts) {
      const params = new URLSearchParams({
        pageSize: "100",
        fields: "files(id,name,mimeType,size)",
        q: "trashed = false",
        ...(opts?.cursor ? { pageToken: opts.cursor } : {}),
      });
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers: auth });
      if (!res.ok) throw new Error(`Drive list failed (HTTP ${res.status}).`);
      const data = (await res.json()) as { files?: { id: string; name: string; mimeType?: string; size?: string }[] };
      return (data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mime: f.mimeType,
        size: f.size ? Number(f.size) : undefined,
        uri: `gdrive://${f.id}`,
      }));
    },
    async fetch(ref: SourceDocRef): Promise<FetchedDocument> {
      const exportAs = ref.mime ? GOOGLE_DOC_EXPORTS[ref.mime] : undefined;
      const url = exportAs
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ref.id)}/export?mimeType=${encodeURIComponent(exportAs.mime)}`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ref.id)}?alt=media`;
      const res = await fetch(url, { headers: auth });
      if (!res.ok) throw new Error(`Drive download failed (HTTP ${res.status}).`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const mime = exportAs?.mime ?? ref.mime ?? res.headers.get("content-type") ?? "application/octet-stream";
      return { bytes, mime, name: ref.name };
    },
  };
}
