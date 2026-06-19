import { randomUUID } from "node:crypto";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { countFoundersApplications, insertFoundersApplication } from "$lib/server/db";
import { upsertFoundersAccessPending } from "$lib/server/founders-access";
import { sendFoundersApplyConfirmationEmail } from "$lib/server/email/founders-apply-confirmation-email";
import { sendFoundersAdminNotifyEmail } from "$lib/server/email/founders-admin-notify-email";
import { ADMIN_BASE } from "$lib/dashboard-base";

/** Public site base for absolute links in mail — PUBLIC_KEYS_DASHBOARD_URL override else request origin. */
function siteBase(origin: string): string {
  const override = (publicEnv.PUBLIC_KEYS_DASHBOARD_URL ?? "").trim();
  if (override) {
    try {
      return new URL(override).origin;
    } catch {
      /* fall through to request origin */
    }
  }
  return origin;
}

function foundersSlotsTotal(): number {
  const n = parseInt(process.env.FOUNDERS_CIRCLE_SLOTS_TOTAL ?? "50", 10);
  if (!Number.isFinite(n) || n < 0) return 50;
  return Math.min(n, 1_000_000);
}

async function deliverFoundersWebhook(
  url: string,
  body: object,
  idempotencyKey: string,
  serverFetch: typeof fetch,
): Promise<{ ok: boolean; status: number }> {
  const max = 3;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      const res = await serverFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.slice(0, 200),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, status: res.status };
      if (res.status >= 500 && attempt < max - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return { ok: false, status: res.status };
    } catch {
      if (attempt < max - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return { ok: false, status: 0 };
    }
  }
  return { ok: false, status: 0 };
}

export const load: PageServerLoad = async () => {
  const slotsTotal = foundersSlotsTotal();
  const displayOverride = process.env.FOUNDERS_SLOTS_REMAINING_DISPLAY?.trim();
  let slotsRemaining: number;
  if (displayOverride !== undefined && displayOverride !== "") {
    const n = parseInt(displayOverride, 10);
    slotsRemaining = Number.isFinite(n) ? Math.max(0, n) : 0;
  } else {
    const used = await countFoundersApplications();
    slotsRemaining = Math.max(0, slotsTotal - used);
  }
  return { slotsRemaining, slotsTotal };
};

const MODULE_VALUES = ["keys", "testing", "graph", "connect", "platform"] as const;

function parseModules(formData: FormData): string[] {
  const raw = formData.getAll("modules");
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v).trim().toLowerCase();
    if (MODULE_VALUES.includes(s as (typeof MODULE_VALUES)[number])) out.push(s);
  }
  return out;
}

export const actions: Actions = {
  default: async ({ request, fetch: serverFetch, url }) => {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const building = String(formData.get("building") ?? "").trim();
    const modules = parseModules(formData);
    const stack = String(formData.get("stack") ?? "").trim();
    const howFound = String(formData.get("howFound") ?? "").trim();
    const listed = String(formData.get("listed") ?? "").trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (!email) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!building) errors.building = "Tell us what you’re building.";
    if (modules.length === 0) errors.modules = "Pick at least one module.";
    if (listed !== "yes" && listed !== "no") errors.listed = "Please choose whether we may list you.";

    const values = {
      name,
      email,
      building,
      modules,
      stack,
      howFound,
      listed,
    };

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values, success: false as const });
    }

    const payload = {
      type: "founders_application",
      submittedAt: new Date().toISOString(),
      name,
      email,
      building,
      modules,
      stack: stack || null,
      howFound: howFound || null,
      listedPublicly: listed === "yes",
    };

    const hasDb = Boolean(env.DATABASE_URL?.trim());
    let applicationId: string;
    if (hasDb) {
      const id = await insertFoundersApplication(payload);
      if (!id) {
        return fail(502, {
          errors: { _form: "We could not save your application. Please try again later." },
          values,
          success: false as const,
        });
      }
      applicationId = id;
      await upsertFoundersAccessPending({
        email,
        applicationId: id,
        applicantName: name,
        submittedAtMs: Date.now(),
      });
    } else {
      applicationId = `local_${randomUUID()}`;
    }

    const webhook = (process.env.FOUNDERS_APPLICATION_WEBHOOK_URL ?? "").trim();
    if (webhook) {
      const delivered = await deliverFoundersWebhook(webhook, payload, applicationId, serverFetch);
      if (!delivered.ok) {
        console.error("[founders] webhook delivery failed after retries", {
          applicationId,
          status: delivered.status,
        });
      }
    }

    // Notify on submission — FAIL-OPEN: the application is already saved, so an email/SMTP
    // failure must never fail this request. Each send records its own outcome (success
    // message-id or sanitised failure reason) to the durable send log. We log ONLY an opaque
    // error name here — an SMTP error can echo the recipient (PII per the security baseline).
    const base = siteBase(url.origin);
    const docsUrl = `${base}/keys/docs`;
    const reviewUrl = `${base}${ADMIN_BASE}/founders`;
    // (a) Applicant confirmation + honest verified-context marketing moment.
    try {
      await sendFoundersApplyConfirmationEmail({ to: email, name, docsUrl });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
      console.error("[founders-apply-confirmation] send failed:", String(code).slice(0, 40));
    }
    // (b) Admin "needs review" notification to the service-owner address(es).
    try {
      await sendFoundersAdminNotifyEmail({ applicantEmail: email, applicantName: name, reviewUrl });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
      console.error("[founders-admin-notify] send failed:", String(code).slice(0, 40));
    }

    return { success: true as const };
  },
};
