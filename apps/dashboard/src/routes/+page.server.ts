import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Server redirect for marketing home so crawlers get a 302. */
export const load: PageServerLoad = async () => {
  // #region agent log
  fetch('http://127.0.0.1:7463/ingest/4d73a77a-e2c7-48aa-ae41-73a13b42405f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fc0f8'},body:JSON.stringify({sessionId:'4fc0f8',location:'+page.server.ts:5',message:'root load reached, redirecting to /keys',data:{env_DATABASE_URL_set:!!process.env.DATABASE_URL,env_NEON_AUTH_set:!!process.env.NEON_AUTH_BASE_URL},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  throw redirect(302, "/keys");
};
