import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Suite `/pricing` — early access only; commercial tiers not sold yet. */
export const load: PageServerLoad = () => {
  throw redirect(308, "/founders");
};
