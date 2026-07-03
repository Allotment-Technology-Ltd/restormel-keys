/**
 * Server-side keys setup: shared in-memory storage and auth for demo.
 * In production use a persistent store and real auth.
 */
import { createKeys } from "@restormel/keys";
import { createMiddleware } from "@restormel/keys/server";
import { createMemoryStorage } from "@restormel/keys/storage/memory";
import type { Auth } from "@restormel/keys/server";
import type { KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";

const storage = createMemoryStorage();

export const demoAuth: Auth = {
  async getUserId(req: Request): Promise<string | null> {
    return req.headers.get("x-user-id") ?? "demo-user";
  },
};

export function getStorage() {
  return storage;
}

export function createKeysForUser(
  userId: string,
  providers: ProviderDefinition[]
): KeysInstance {
  return createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    {
      providers,
      getByokKeys: async () => {
        const list = await storage.list(userId);
        return list.map((k) => ({ id: k.id, provider: k.provider ?? "", label: k.label }));
      },
    }
  );
}

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
