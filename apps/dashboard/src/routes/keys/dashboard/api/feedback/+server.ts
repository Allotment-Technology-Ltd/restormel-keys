import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readFileSync } from "node:fs";

type FeedbackCategory = "bug" | "question" | "feature";

type FeedbackBody = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
};

const FEEDBACK_GITHUB_REPO = "Allotment-Technology-Ltd/restormel-keys";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const sessionSubmissions = new Map<string, number[]>();

const dashboardVersion = (() => {
  const fromEnv = (process.env.RESTORMEL_DASHBOARD_VERSION ?? "").trim();
  if (fromEnv) return fromEnv;
  try {
    const pkgPath = new URL("../../../../../../package.json", import.meta.url);
    const pkgRaw = readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(pkgRaw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
})();

function enforceRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const existing = sessionSubmissions.get(sessionId) ?? [];
  const active = existing.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (active.length >= RATE_LIMIT_MAX) {
    sessionSubmissions.set(sessionId, active);
    return false;
  }
  active.push(now);
  sessionSubmissions.set(sessionId, active);
  return true;
}

function validatePayload(payload: FeedbackBody): {
  ok: true;
  value: { title: string; description: string; category: FeedbackCategory };
} | {
  ok: false;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const category = payload.category;

  if (!title) errors.title = "Title is required.";
  else if (title.length > 200) errors.title = "Title must be 200 characters or fewer.";
  if (!description) errors.description = "Description is required.";
  else if (description.length > 2000) errors.description = "Description must be 2000 characters or fewer.";
  const isCategory =
    category === "bug" || category === "question" || category === "feature";
  if (!isCategory) {
    errors.category = "Category must be one of bug, question, or feature.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, description, category: category as FeedbackCategory } };
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user || locals.user.authType === "gateway_key" || locals.user.authType === "management_key") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = locals.user.uid;
  if (!enforceRateLimit(sessionId)) {
    return json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  let body: FeedbackBody;
  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validatePayload(body);
  if (!validated.ok) {
    return json({ error: "Validation failed.", fieldErrors: validated.errors }, { status: 400 });
  }

  const feedbackToken = (process.env.FEEDBACK_GITHUB_TOKEN ?? "").trim();
  const repo = (process.env.FEEDBACK_GITHUB_REPO ?? FEEDBACK_GITHUB_REPO).trim();
  if (!repo.includes("/")) {
    console.error("[feedback] FEEDBACK_GITHUB_REPO must be owner/repo format.", { repo });
    return json({ ok: true });
  }
  const submittedBy = (locals.user.email ?? "").trim() || "anonymous";

  if (!feedbackToken) {
    console.warn("[feedback] FEEDBACK_GITHUB_TOKEN is not set; feedback not sent to GitHub.");
    console.log("[feedback] local feedback payload", {
      category: validated.value.category,
      title: validated.value.title,
      description: validated.value.description,
      submittedBy,
      dashboardVersion,
    });
    return json({ ok: true });
  }

  const issueTitle = `[User Feedback] ${validated.value.category}: ${validated.value.title}`;
  const issueBody =
    `${validated.value.description}\n\n` +
    `---\n` +
    `**Category:** ${validated.value.category}\n` +
    `**Submitted by:** ${submittedBy}\n` +
    `**Dashboard version:** ${dashboardVersion}\n`;

  try {
    const issueRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${feedbackToken}`,
        "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "restormel-keys-dashboard-feedback",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["user-feedback", validated.value.category],
      }),
    });

    if (!issueRes.ok) {
      const detail = await issueRes.text().catch(() => "");
      console.error("[feedback] GitHub issue create failed", issueRes.status, detail.slice(0, 240));
      console.log("[feedback] local feedback payload", {
        category: validated.value.category,
        title: validated.value.title,
        description: validated.value.description,
        submittedBy,
        dashboardVersion,
        repo,
      });
      return json({ ok: true });
    }
  } catch (error) {
    console.error("[feedback] GitHub issue request failed", error);
    console.log("[feedback] local feedback payload", {
      category: validated.value.category,
      title: validated.value.title,
      description: validated.value.description,
      submittedBy,
      dashboardVersion,
      repo,
    });
    return json({ ok: true });
  }

  return json({ ok: true });
};
