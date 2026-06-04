/**
 * Pure SurrealDB connection-string parser (no DB/crypto imports) so it is
 * trivially unit-testable. Lets operators paste one string and connect.
 *
 * Accepts:
 * - ws/wss/http/https/surrealdb/surreal URI forms
 * - schemeless hosts (treated as https)
 * - ADO-style key=value strings (Surreal .NET SDK / Surrealist copy)
 * - labelled lines (`Endpoint: wss://…`) and CLI `--endpoint` snippets
 * - `/rpc` path suffix (WebSocket RPC — not a namespace)
 */
export type ParsedSurrealConnection = {
  endpoint?: string;
  namespace?: string;
  database?: string;
  username?: string;
  secret?: string;
  error?: string;
};

const URL_SCHEMES = new Set(["ws", "wss", "http", "https", "surrealdb", "surreal"]);

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeInput(input: string): string {
  return stripWrappingQuotes(input.replace(/\r\n/g, "\n").trim());
}

function mapSchemeToHttpEndpoint(scheme: string, host: string): string {
  const httpScheme = scheme === "ws" || scheme === "http" ? "http" : "https";
  return `${httpScheme}://${host}`;
}

function pathToNsDb(pathname: string): { namespace?: string; database?: string } {
  let segments = pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() === "rpc") segments = segments.slice(1);
  return {
    namespace: segments[0] ? decodeURIComponent(segments[0]) : undefined,
    database: segments[1] ? decodeURIComponent(segments[1]) : undefined,
  };
}

function parseAuth(auth: string): { username?: string; secret?: string } {
  const colon = auth.indexOf(":");
  if (colon === -1) {
    return { username: decodeURIComponent(auth) };
  }
  return {
    username: decodeURIComponent(auth.slice(0, colon)),
    secret: decodeURIComponent(auth.slice(colon + 1)),
  };
}

/** Manual URI parse — survives unencoded `@` or `:` in passwords. */
function parseUriLike(raw: string): ParsedSurrealConnection | null {
  const match = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([\s\S]*)$/);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  if (!URL_SCHEMES.has(scheme)) return null;

  let rest = match[2];
  let username: string | undefined;
  let secret: string | undefined;

  const at = rest.lastIndexOf("@");
  if (at !== -1) {
    const authPart = rest.slice(0, at);
    rest = rest.slice(at + 1);
    ({ username, secret } = parseAuth(authPart));
  }

  const slash = rest.indexOf("/");
  const host = (slash === -1 ? rest : rest.slice(0, slash)).trim();
  const path = slash === -1 ? "" : rest.slice(slash);
  if (!host) return { error: "Connection string is missing a host." };

  const { namespace, database } = pathToNsDb(path);
  return {
    endpoint: mapSchemeToHttpEndpoint(scheme, host),
    namespace,
    database,
    username,
    secret,
  };
}

function parseWithUrlConstructor(withScheme: string): ParsedSurrealConnection | null {
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(":", "").toLowerCase();
  if (!URL_SCHEMES.has(scheme)) return null;
  if (!url.hostname) return { error: "Connection string is missing a host." };

  const endpoint = mapSchemeToHttpEndpoint(scheme, url.host);
  const { namespace, database } = pathToNsDb(url.pathname);
  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const secret = url.password ? decodeURIComponent(url.password) : undefined;
  return { endpoint, namespace, database, username, secret };
}

const ADO_ENDPOINT_KEYS = new Set(["endpoint", "server", "client"]);
const ADO_NAMESPACE_KEYS = new Set(["namespace", "ns"]);
const ADO_DATABASE_KEYS = new Set(["database", "db"]);
const ADO_USERNAME_KEYS = new Set(["username", "user"]);
const ADO_SECRET_KEYS = new Set(["password", "pass", "token"]);

export function looksLikeSurrealJwt(value: string): boolean {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value.trim());
}

function looksLikeJwt(value: string): boolean {
  return looksLikeSurrealJwt(value);
}

/** Best-effort NS/DB extraction from Surreal Cloud CLI JWTs (no signature verification). */
export function extractSurrealClaimsFromJwt(token: string): { namespace?: string; database?: string } {
  const parts = token.trim().split(".");
  if (parts.length < 2) return {};
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
    const pick = (keys: string[]) => {
      for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };
    return {
      namespace: pick(["NS", "ns", "namespace", "Namespace"]),
      database: pick(["DB", "db", "database", "Database"]),
    };
  } catch {
    return {};
  }
}

function enrichFromJwt(parsed: ParsedSurrealConnection): ParsedSurrealConnection {
  if (parsed.error || !parsed.secret || (parsed.namespace && parsed.database)) return parsed;
  const claims = extractSurrealClaimsFromJwt(parsed.secret);
  return {
    ...parsed,
    namespace: parsed.namespace ?? claims.namespace,
    database: parsed.database ?? claims.database,
  };
}

function parseAdoStyle(raw: string): ParsedSurrealConnection | null {
  if (!raw.includes("=")) return null;
  // Pure URI forms should not go through ADO parsing.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) && !/^[a-zA-Z_]+\s*=/.test(raw)) return null;

  const fields: Record<string, string> = {};
  for (const segment of raw.split(";")) {
    const piece = segment.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const key = piece.slice(0, eq).trim().toLowerCase();
    const value = piece.slice(eq + 1).trim();
    if (value) fields[key] = stripWrappingQuotes(value);
  }

  const endpointRaw = [...ADO_ENDPOINT_KEYS].map((k) => fields[k]).find(Boolean);
  if (!endpointRaw) return null;

  const endpointParsed = parseSurrealConnectionStringInternal(endpointRaw);
  if (endpointParsed.error && !endpointParsed.endpoint) return endpointParsed;

  const namespace = [...ADO_NAMESPACE_KEYS].map((k) => fields[k]).find(Boolean);
  const database = [...ADO_DATABASE_KEYS].map((k) => fields[k]).find(Boolean);
  const username = [...ADO_USERNAME_KEYS].map((k) => fields[k]).find(Boolean);
  const secret = [...ADO_SECRET_KEYS].map((k) => fields[k]).find(Boolean);

  return {
    endpoint: endpointParsed.endpoint,
    namespace: namespace ?? endpointParsed.namespace,
    database: database ?? endpointParsed.database,
    username: username ?? endpointParsed.username,
    secret: secret ?? endpointParsed.secret,
  };
}

function parseLabelledLines(raw: string): ParsedSurrealConnection | null {
  if (!raw.includes("\n") && !/^(endpoint|server|namespace|database|username|password)\s*:/i.test(raw)) {
    return null;
  }

  const fields: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const piece = line.trim();
    if (!piece) continue;
    const m = piece.match(/^([a-zA-Z_ ]+)\s*:\s*(.+)$/);
    if (!m) continue;
    fields[m[1].trim().toLowerCase().replace(/\s+/g, "_")] = stripWrappingQuotes(m[2].trim());
  }

  const endpointRaw =
    fields.endpoint ?? fields.server ?? fields.instance_endpoint ?? fields.instance ?? fields.url;
  if (!endpointRaw) return null;

  const endpointParsed = parseSurrealConnectionStringInternal(endpointRaw);
  if (endpointParsed.error && !endpointParsed.endpoint) return endpointParsed;

  return {
    endpoint: endpointParsed.endpoint,
    namespace: fields.namespace ?? fields.ns ?? endpointParsed.namespace,
    database: fields.database ?? fields.db ?? endpointParsed.database,
    username: fields.username ?? fields.user ?? endpointParsed.username,
    secret: fields.password ?? fields.pass ?? fields.token ?? endpointParsed.secret,
  };
}

function parseCliSnippet(raw: string): ParsedSurrealConnection | null {
  if (!/(^|\s)--(endpoint|ns|db|token|username|password)\b/i.test(raw)) return null;

  const readFlag = (names: string[]): string | undefined => {
    for (const name of names) {
      const re = new RegExp(`--${name}\\s+(?:"([^"]*)"|'([^']*)'|(\\S+))`, "i");
      const m = raw.match(re);
      if (m) return m[1] ?? m[2] ?? m[3];
    }
    return undefined;
  };

  const endpointRaw = readFlag(["endpoint"]);
  if (!endpointRaw) return null;

  const endpointParsed = parseSurrealConnectionStringInternal(endpointRaw);
  if (endpointParsed.error && !endpointParsed.endpoint) return endpointParsed;

  return enrichFromJwt({
    endpoint: endpointParsed.endpoint,
    namespace: readFlag(["ns", "namespace"]) ?? endpointParsed.namespace,
    database: readFlag(["db", "database"]) ?? endpointParsed.database,
    username: readFlag(["username", "user"]) ?? endpointParsed.username,
    secret: readFlag(["token", "password", "pass"]) ?? endpointParsed.secret,
  });
}

function parseSurrealConnectionStringInternal(input: string): ParsedSurrealConnection {
  const raw = normalizeInput(input);
  if (!raw) return { error: "Connection string is empty." };

  const labelled = parseLabelledLines(raw);
  if (labelled && !labelled.error) return labelled;

  const cli = parseCliSnippet(raw);
  if (cli && !cli.error) return cli;

  const ado = parseAdoStyle(raw);
  if (ado && !ado.error) return ado;

  let candidate = raw;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const fromUrl = parseWithUrlConstructor(candidate);
  if (fromUrl && !fromUrl.error) return fromUrl;

  const fromUri = parseUriLike(raw);
  if (fromUri && !fromUri.error) return fromUri;

  if (fromUrl?.error) return fromUrl;
  if (fromUri?.error) return fromUri;

  return {
    error:
      "Could not parse the connection string. Paste a wss:// or https:// URL, a Surreal CLI command (--endpoint … --token …), or an ADO-style string like Server=wss://host;Namespace=ns;Database=db.",
  };
}

export function parseSurrealConnectionString(input: string): ParsedSurrealConnection {
  const parsed = parseSurrealConnectionStringInternal(input);
  if (parsed.error) return parsed;
  return enrichFromJwt(parsed);
}
