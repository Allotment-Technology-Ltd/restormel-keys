import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { verifyJwtRs256 } from "$lib/server/oidc";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.formData().catch(() => null);
  const code = body?.get("code");
  if (typeof code !== "string") return json({ error: "invalid_request" }, { status: 400 });

  try {
    const { payload } = verifyJwtRs256(code);
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload?.exp === "number" ? payload.exp : now + 3600;
    const expires_in = Math.max(1, exp - now);
    return json({
      access_token: code,
      id_token: code,
      token_type: "Bearer",
      expires_in,
    });
  } catch {
    return json({ error: "invalid_grant" }, { status: 400 });
  }
};

