import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { jwksFromPublicKey } from "$lib/server/oidc";

export const GET: RequestHandler = async () => {
  const { keys } = jwksFromPublicKey();
  return json({ keys }, { headers: { "cache-control": "public, max-age=3600" } });
};

