import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const dashboardUrl = `${url.origin}/keys/dashboard`;
  const paddleToken = process.env.PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  return { dashboardUrl, paddleToken };
};
