import { redirect } from "@sveltejs/kit";
import { CONNECT_MCP_HREF } from "$lib/dashboard-hub-nav";

/** Legacy pipeline path → Connect hub MCP tab. */
export const load = () => {
  throw redirect(302, CONNECT_MCP_HREF);
};
