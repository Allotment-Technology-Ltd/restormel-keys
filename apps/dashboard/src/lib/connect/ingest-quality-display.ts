export type QualityDescriptorTint = "red" | "yellow" | "green" | "muted";

export type QualityDescriptor = {
  label: string;
  tint: QualityDescriptorTint;
  full: string;
};

export function trustScoreDescriptor(score: number | null | undefined): QualityDescriptor {
  const n = score ?? 0;
  if (n < 60) {
    return { label: "Needs attention", tint: "red", full: `${n} — Needs attention` };
  }
  if (n < 80) {
    return { label: "Moderate", tint: "yellow", full: `${n} — Moderate` };
  }
  return { label: "Strong", tint: "green", full: `${n} — Strong` };
}

export function unitsSupportedDescriptor(pct: number | null | undefined): QualityDescriptor {
  const n = pct ?? 0;
  if (n < 50) {
    return {
      label: "Below average",
      tint: "red",
      full: `${n}% supported (below average)`,
    };
  }
  if (n < 80) {
    return { label: "Moderate", tint: "yellow", full: `${n}% supported (moderate)` };
  }
  return { label: "Strong coverage", tint: "green", full: `${n}% supported (strong coverage)` };
}

export function ingestStatusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "running") return "In progress";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function formatRunDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `Completed in ${m}m ${s}s`;
  return `Completed in ${s}s`;
}
