/**
 * Public Connect ingest webhook delivery (I1).
 *
 * Fired when an ingest job reaches a terminal state. Looks up active webhooks for
 * the workspace + event, POSTs an HMAC-SHA256-signed payload to each URL, retries
 * with exponential backoff, and records every attempt. Fire-and-forget: never
 * throws into, or blocks, the worker.
 */
import { createHmac } from "node:crypto";
import {
  listConnectWebhooksForDelivery,
  recordConnectWebhookDelivery,
} from "$lib/server/neon";

export type ConnectWebhookEvent = "job.completed" | "job.failed" | "job.quality_below_threshold";

/** Curated public quality report (matches ConnectIngestQualityReport in contracts). */
export type ConnectWebhookQualityReport = {
  trust_score: number;
  supported_count: number;
  weak_count: number;
  unsupported_count: number;
  total_count: number;
  remediation_applied: boolean;
  assessed_at: string;
};

export type TerminalIngestJob = {
  jobId: string;
  workspaceId: string;
  status: "completed" | "failed";
  qualityReport: ConnectWebhookQualityReport | null;
};

/** Default trust-score floor for job.quality_below_threshold when a webhook omits one. */
const DEFAULT_QUALITY_THRESHOLD = 70;
/** Exponential backoff between the (up to 3) delivery attempts. */
const BACKOFF_MS = [5_000, 30_000, 300_000];
const MAX_ATTEMPTS = 3;
const DELIVERY_TIMEOUT_MS = 10_000;

function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverWithRetry(args: {
  webhookId: string;
  workspaceId: string;
  jobId: string;
  url: string;
  event: ConnectWebhookEvent;
  secret: string;
  body: string;
}): Promise<void> {
  const sig = signPayload(args.body, args.secret);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const res = await fetch(args.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Restormel-Event": args.event,
          "X-Restormel-Signature": `sha256=${sig}`,
          "User-Agent": "Restormel-Connect-Webhooks/1",
        },
        body: args.body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      await recordConnectWebhookDelivery({
        webhookId: args.webhookId,
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        event: args.event,
        attempt,
        ok: res.ok,
        statusCode: res.status,
        durationMs: Date.now() - startedAt,
      });
      if (res.ok) return; // delivered
    } catch (e) {
      await recordConnectWebhookDelivery({
        webhookId: args.webhookId,
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        event: args.event,
        attempt,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
      });
    }
    // Back off before the next attempt (no wait after the final attempt).
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
  }
}

function buildBody(
  webhookId: string,
  event: ConnectWebhookEvent,
  job: TerminalIngestJob,
): string {
  return JSON.stringify({
    webhook_id: webhookId,
    event,
    timestamp: new Date().toISOString(),
    data: {
      job_id: job.jobId,
      workspace_id: job.workspaceId,
      status: job.status,
      quality_report: job.qualityReport,
    },
  });
}

async function dispatchEvent(event: ConnectWebhookEvent, job: TerminalIngestJob): Promise<void> {
  let hooks: Awaited<ReturnType<typeof listConnectWebhooksForDelivery>>;
  try {
    hooks = await listConnectWebhooksForDelivery(job.workspaceId, event);
  } catch (e) {
    console.error("[connect-webhook] lookup failed", event, e);
    return;
  }
  for (const hook of hooks) {
    // job.quality_below_threshold only fires when the run's trust score is under the
    // per-webhook threshold (default 70).
    if (event === "job.quality_below_threshold") {
      const trust = job.qualityReport?.trust_score;
      if (typeof trust !== "number") continue;
      const threshold = hook.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;
      if (trust >= threshold) continue;
    }
    await deliverWithRetry({
      webhookId: hook.id,
      workspaceId: job.workspaceId,
      jobId: job.jobId,
      url: hook.url,
      event,
      secret: hook.signingSecretPlaintext,
      body: buildBody(hook.id, event, job),
    });
  }
}

/**
 * Fire-and-forget: dispatch all webhooks subscribed to this job's terminal event(s).
 * Returns immediately; delivery (with retries/backoff) runs in the background.
 */
export function dispatchConnectIngestWebhooks(job: TerminalIngestJob): void {
  void (async () => {
    const events: ConnectWebhookEvent[] = [job.status === "completed" ? "job.completed" : "job.failed"];
    // Quality-gate event is evaluated whenever a quality report exists.
    if (job.qualityReport) events.push("job.quality_below_threshold");
    for (const event of events) {
      await dispatchEvent(event, job);
    }
  })();
}
