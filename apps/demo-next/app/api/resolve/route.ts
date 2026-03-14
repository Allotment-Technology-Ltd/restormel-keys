import {
  createKeysForUser,
  demoAuth,
  getStorage,
} from "@/app/lib/keys-server";
import { createResolveMiddleware } from "@restormel/keys/server";
import { openaiProvider, anthropicProvider } from "@restormel/keys";

const providers = [openaiProvider, anthropicProvider];

export async function GET(req: Request) {
  const userId = await demoAuth.getUserId(req);
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const keys = createKeysForUser(userId, providers);
  const storage = getStorage();
  const resolveMiddleware = createResolveMiddleware(keys, {
    auth: demoAuth,
    getByokKeys: (uid) =>
      storage.list(uid).then((list) =>
        list.map((k) => ({
          id: k.id,
          provider: k.provider ?? "",
          label: k.label,
        }))
      ),
  });
  const ctx = { userId: null as string | null, resolved: null, error: null };
  const errorResponse = await resolveMiddleware(req, ctx);
  if (errorResponse) return errorResponse;
  return Response.json(ctx.resolved);
}
