import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** Redirect browsers that request /favicon.ico to our SVG favicon. */
export const GET: RequestHandler = () => {
  throw redirect(302, "/favicon.svg");
};
