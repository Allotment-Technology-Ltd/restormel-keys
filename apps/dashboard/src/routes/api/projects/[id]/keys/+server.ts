import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listApiKeys, createApiKey, deleteApiKey } from "$lib/server/firestore";

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const keys = await listApiKeys(params.id, locals.user.uid);
  return json({ data: keys });
};

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const result = await createApiKey(params.id, locals.user.uid);
  if (!result) return json({ error: "Not found" }, { status: 404 });
  return json({ data: { rawKey: result.rawKey, keyPrefix: result.keyPrefix } }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : params.keyId;
  if (!keyId) return json({ error: "Missing keyId" }, { status: 400 });
  const ok = await deleteApiKey(params.id, keyId, locals.user.uid);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
