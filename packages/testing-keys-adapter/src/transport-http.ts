import type { KeysHttpResolveResponseBody, KeysResolutionTransport, KeysTransportResolution } from "./types.js";

function isResolveBody(x: unknown): x is KeysHttpResolveResponseBody {
  if (x === null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.provider === "string" &&
    typeof o.model === "string" &&
    typeof o.secretEnvVar === "string" &&
    o.provider.length > 0 &&
    o.model.length > 0 &&
    o.secretEnvVar.length > 0
  );
}

/**
 * Calls Keys over HTTP. Path is versioned under this repo’s adapter until Keys publishes a canonical route.
 */
export function createHttpKeysTransport(options: {
  baseUrl: string;
  /** Return bearer token for Keys API (not the provider key). */
  getKeysApiToken?: () => string | undefined;
}): KeysResolutionTransport {
  const root = options.baseUrl.replace(/\/?$/, "");
  return {
    async resolve(logicalRef: string): Promise<KeysTransportResolution> {
      const url = `${root}/v1/testing/resolve-model`;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
      };
      const token = options.getKeysApiToken?.();
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ logicalRef }),
        });
      } catch (e) {
        return {
          ok: false,
          code: "network",
          message: `Keys HTTP request failed: ${e instanceof Error ? e.message : String(e)}`,
          cause: e,
        };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          code: `http_${res.status}`,
          message: `Keys returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        };
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch (e) {
        return { ok: false, code: "invalid_json", message: "Keys response was not JSON", cause: e };
      }
      if (!isResolveBody(body)) {
        return { ok: false, code: "invalid_body", message: "Keys response missing provider, model, or secretEnvVar" };
      }
      return {
        ok: true,
        provider: body.provider,
        model: body.model,
        secretEnvVar: body.secretEnvVar,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      };
    },
  };
}
