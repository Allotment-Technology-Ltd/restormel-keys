import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  addServiceAdminEmail,
  listServiceAdminEmails,
  removeServiceAdminEmail,
} from "$lib/server/service-admin-emails";

export const config = { runtime: "nodejs22.x" as const };

export const GET: RequestHandler = async ({ locals }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  const emails = await listServiceAdminEmails();
  return json({ emails });
};

type PostBody = { email?: string; note?: string };

export const POST: RequestHandler = async ({ locals, request }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email) {
    return json({ error: "email_required" }, { status: 400 });
  }

  const result = await addServiceAdminEmail({
    email,
    createdByUserId: u.uid,
    note: body.note?.trim() || null,
  });

  if (!result.ok) {
    return json({ error: "save_failed", message: result.message }, { status: 400 });
  }

  return json({ ok: true }, { status: 201 });
};

type DeleteBody = { email?: string };

export const DELETE: RequestHandler = async ({ locals, request }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email) {
    return json({ error: "email_required" }, { status: 400 });
  }

  const result = await removeServiceAdminEmail(email);
  if (!result.ok) {
    return json({ error: "delete_failed", message: result.message }, { status: 400 });
  }

  return json({ ok: true });
};
