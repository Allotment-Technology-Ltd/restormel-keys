import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { verifyJwtRs256 } from "$lib/server/oidc";

export const GET: RequestHandler = async ({ request }) => {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "unauthorized" }, { status: 401 });

  try {
    const { payload } = verifyJwtRs256(token);
    return json({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });
  } catch {
    return json({ error: "unauthorized" }, { status: 401 });
  }
};

