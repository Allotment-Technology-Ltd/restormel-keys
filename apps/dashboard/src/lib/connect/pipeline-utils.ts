import { DASHBOARD_BASE } from "$lib/dashboard-base";

export function pipelineStatusClass(status: string): string {
  if (status === "ok" || status === "parsed") return "status-success";
  if (status === "error" || status === "failed") return "status-error";
  if (status === "pending") return "status-warning";
  return "status-muted";
}

export function formatSourceKind(kind: string, name?: string): string {
  if (name?.startsWith("Starter:")) return "Starter";
  const labels: Record<string, string> = {
    upload: "Upload",
    url: "URL",
    s3: "S3",
    google_drive: "Drive",
    sharepoint: "SharePoint",
  };
  return labels[kind] ?? kind.replace(/_/g, " ");
}

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function formatDocMeta(doc: {
  char_count: number;
  chunk_count: number;
  mime?: string;
}): string {
  const parts = [`${doc.chunk_count} chunk${doc.chunk_count === 1 ? "" : "s"}`, `${formatCompactCount(doc.char_count)} chars`];
  if (doc.mime) parts.push(doc.mime.split(";")[0].trim());
  return parts.join(" · ");
}

export function csvList(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
