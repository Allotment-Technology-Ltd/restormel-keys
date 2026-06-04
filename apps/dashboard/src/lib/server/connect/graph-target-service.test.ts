import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSurrealBearerToken, surrealHttpQuery, surrealSignIn } from "./graph-target-service";

const conn = {
  endpoint: "https://instance.surreal.cloud",
  namespace: "production",
  database: "knowledge",
  username: "editor",
  password: "s3cret",
};

describe("surrealSignIn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs in namespace users via POST /signin before /sql", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/signin")) {
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        if (body.ns === conn.namespace && body.user === conn.username && !body.db) {
          return new Response(JSON.stringify({ token: "session-token" }), { status: 200 });
        }
        return new Response("unauthorized", { status: 401 });
      }
      return new Response(JSON.stringify([{ status: "OK", result: true }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const signin = await surrealSignIn(conn);
    expect(signin).toEqual({ ok: true, token: "session-token" });

    const query = await surrealHttpQuery({ ...conn, sql: "RETURN true;" });
    expect(query.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://instance.surreal.cloud/signin",
      expect.objectContaining({ method: "POST" }),
    );
    const sqlCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/sql"));
    expect(sqlCall?.[1]?.headers).toMatchObject({
      Authorization: "Bearer session-token",
    });
  });

  it("uses bearer tokens directly when username is empty", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ status: "OK", result: true }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = await resolveSurrealBearerToken({
      ...conn,
      username: null,
      password: "eyJhbGciOiJIUzI1NiJ9.eyJNSIjoicHJvZCJ9.sig",
    });
    expect(auth).toEqual({
      ok: true,
      token: "eyJhbGciOiJIUzI1NiJ9.eyJNSIjoicHJvZCJ9.sig",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
