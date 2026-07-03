/**
 * Server-side keys setup: in-memory storage for demo. No auth.
 */
import { createKeys } from "@restormel/keys";
import { createMiddleware } from "@restormel/keys/server";
import { createMemoryStorage } from "@restormel/keys/storage/memory";
import type { Auth } from "@restormel/keys/server";
import type { ProviderDefinition } from "@restormel/keys";

const storage = createMemoryStorage();

export const demoAuth: Auth = {
  async getUserId(req: Request): Promise<string | null> {
    return req.headers.get("x-user-id") ?? "demo-user";
  },
};

export function createKeysHandler(providers: ProviderDefinition[]) {
  const keys = createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    { providers }
  );
  return createMiddleware(keys, {
    auth: demoAuth,
    storage,
    providers,
    path: "/api/keys",
  });
}
