# SOPHIA integration with @restormel/keys (Prompt 2.7)

**Scope:** Work is performed **in the SOPHIA repo** (`Allotment-Technology-Ltd/sophia`). This doc is the runbook and template for that integration.

**Local path (for scripts/reuse):** `/Users/adamboon/projects/sophia`. Useful for reusing Paddle setup: `scripts/bootstrap-paddle.ts`, `scripts/sync-paddle-prod-secrets.sh`, and billing code under `src/lib/server/billing/` (e.g. `paddle.ts`, webhook, checkout, portal).

**Goal:** Replace SOPHIA's inline BYOK code with `@restormel/keys` while keeping API contracts, billing (wallet, top-ups, founder offers), and existing functionality.

**Gate:** SOPHIA tests pass. BYOK works end-to-end.

---

## 1. In SOPHIA repo: add dependency

```bash
pnpm add @restormel/keys
```

---

## 2. Create `src/lib/server/keys-adapter.ts`

This module configures `createKeys` with SOPHIA's providers and Firestore-backed key storage. Adapt the following to your Firestore schema and auth.

### 2.1 Implement KeyStorage using Firestore

`@restormel/keys` server middleware expects a `KeyStorage` (see `packages/core/src/storage/types.ts`): `get`, `list`, `set`, `delete`, `getUsage`, `trackUsage`. Implement this by delegating to your existing Firestore key collection (e.g. the same collection used by `apiAuth.ts` for key metadata). **Do not store raw API keys in config or in logs;** store only hashed keys and metadata (id, provider, label). Raw key material should follow your existing pattern (e.g. HMAC hash in Firestore, raw key returned only at creation).

Example shape (adapt paths and types to SOPHIA). Implement `KeyStorage` using your Firestore client (see `@restormel/keys` storage types):

```ts
// src/lib/server/keys-adapter.ts
import {
  createKeys,
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { KeyConfig, KeysInstance } from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import { createMiddleware, createResolveMiddleware } from "@restormel/keys/server";
import type { Auth, ResolveContext } from "@restormel/keys/server";
import type { KeyStorage, StoredKey, StoredUsage } from "@restormel/keys/storage/types";

const providers: ProviderDefinition[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
];

// --- 1) Firestore-backed KeyStorage ---
// Implement using your Firestore key collection (e.g. users/{uid}/apiKeys).
// Store only metadata (id, provider, label); raw key material per your existing hash/store pattern.

export function createFirestoreKeyStorage(getDb: () => YourFirestoreClient): KeyStorage {
  return {
    async get(userId, keyId) {
      const docRef = getDb().collection("users").doc(userId).collection("keys").doc(keyId);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      const d = doc.data();
      return d ? { id: doc.id, provider: d.provider, label: d.label } : null;
    },
    async list(userId) {
      const snap = await getDb().collection("users").doc(userId).collection("keys").get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        return { id: doc.id, provider: d.provider, label: d.label };
      });
    },
    async set(userId, keyId, value: StoredKey) {
      await getDb()
        .collection("users")
        .doc(userId)
        .collection("keys")
        .doc(keyId)
        .set({ provider: value.provider, label: value.label ?? null }, { merge: true });
    },
    async delete(userId, keyId) {
      await getDb().collection("users").doc(userId).collection("keys").doc(keyId).delete();
    },
    async getUsage(_userId, _keyId) { return []; },
    async trackUsage(_userId, _keyId, _usage: StoredUsage) {},
  };
}

// --- 2) Auth: Request → userId (use SOPHIA's session/Firebase auth) ---
export const sophiaAuth: Auth = {
  async getUserId(req: Request): Promise<string | null> {
    return getUserIdFromRequest(req); // your existing helper
  },
};

// --- 3) createKeys per user with getByokKeys from storage ---
export function createKeysForUser(
  userId: string,
  storage: KeyStorage,
  provs: ProviderDefinition[] = providers
): KeysInstance {
  return createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    {
      providers: provs,
      getByokKeys: async () => {
        const list = await storage.list(userId);
        return list.map((k) => ({ id: k.id, provider: k.provider, label: k.label })) as KeyConfig[];
      },
    }
  );
}

// --- 4) Key management handler (GET list, POST add, DELETE) ---
export function createKeysHandler(storage: KeyStorage, path = "/api/v1/keys") {
  const keys = createKeys(
    { keys: [], routing: { defaultProvider: "openai" } },
    { providers }
  );
  return createMiddleware(keys, { auth: sophiaAuth, storage, providers, path });
}

// --- 5) Resolve: use createResolveMiddleware(req, ctx); ctx.resolved set on success ---
export function createResolveHandler(storage: KeyStorage) {
  return async (req: Request): Promise<Response | null> => {
    const keys = createKeys(
      { keys: [], routing: { defaultProvider: "openai" } },
      {
        providers,
        getByokKeys: (uid) =>
          storage.list(uid).then((list) =>
            list.map((k) => ({ id: k.id, provider: k.provider, label: k.label })) as KeyConfig[]
          ),
      }
    );
    const ctx: ResolveContext = { userId: null, resolved: null, error: null };
    const resolveMw = createResolveMiddleware(keys, {
      auth: sophiaAuth,
      getByokKeys: (uid) =>
        storage.list(uid).then((list) =>
          list.map((k) => ({ id: k.id, provider: k.provider, label: k.label })) as KeyConfig[]
        ),
    });
    const res = await resolveMw(req, ctx);
    if (res) return res;
    // Resolved: use ctx.resolved / ctx.userId
    return null;
  };
}
```

- **POST (add key):** The Keys middleware validates the key and calls `storage.set(userId, id, { id, provider, label })`. It does **not** store the raw key. In SOPHIA you already store the hashed key in Firestore at creation time. Either:
  - Intercept POST in your route: first create the key in Firestore (hash + metadata) using your existing logic, then call the Keys middleware for the response; or
  - Extend your Firestore `KeyStorage.set` so that when the middleware calls `set`, you also receive the raw key from the request body and persist the hash in the same document (ensure the route passes the body to the handler that has access to it). The standard middleware reads body once, so you may need a small wrapper that stores the hash then calls the middleware.
- **getKeyValue for proxy:** If you use the Keys proxy, you must provide `getKeyValue(userId, resolved)` that returns the raw key for the resolved key id. Implement that by reading from your secure store (e.g. decrypt or look up by id from the same Firestore doc where you store the key material or its reference).

---

## 3. Refactor BYOK routes to use Keys middleware

- Replace inline key CRUD in `src/routes/api/v1/keys/+server.ts` (or equivalent) with a call to the handler from `keys-adapter.ts` (e.g. `createKeysHandler(storage)(request)`).
- Keep the same URL and response shapes so **API contracts do not change**.
- Use the same auth and Firestore collection as today so existing clients and tests keep working.

---

## 4. Keep SOPHIA-specific billing

- **Do not** remove or replace: wallet, top-ups, founder offers.
- Billing routes and logic remain in SOPHIA; only BYOK key management is delegated to @restormel/keys.

---

## 5. Verify

- Run the full SOPHIA test suite; all tests must pass.
- Manually verify the full BYOK flow: add key, list keys, use key for a request, delete key.

---

## DO NOT

- Change SOPHIA's API contracts (URLs, request/response shapes).
- Remove SOPHIA-specific billing (wallet, top-ups, founder offers).
- Break existing functionality.

---

## Gate

- **SOPHIA tests pass.**
- **BYOK works end-to-end.**

---

## See also

- **SOPHIA dogfooding plan** — [sophia-dogfooding-plan.md](sophia-dogfooding-plan.md): using Restormel Keys for the **ingestion pipeline** (fallback routes and policies) and **embedded UI** (ModelSelector) so end-users can select models for philosophy queries. That plan extends this runbook with ingestion + resolve API + policies + embeddable model selection.
