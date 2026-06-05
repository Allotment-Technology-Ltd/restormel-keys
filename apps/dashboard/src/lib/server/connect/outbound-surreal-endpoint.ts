/**
 * Policy for server-side fetch to workspace-configured Surreal HTTP endpoints (SSRF mitigation).
 * Local dev may use http://localhost; production requires HTTPS and blocks private/metadata targets.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
]);

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function parseEndpointUrl(endpoint: string): URL | null {
  const trimmed = endpoint.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const n = ipv4ToInt(host);
  if (n === null) return false;
  if ((n & 0xff) === 0x7f) return true; // 127.0.0.0/8
  if ((n & 0xff000000) === 0x0a000000) return true; // 10.0.0.0/8
  if ((n & 0xfff00000) === 0xac100000) return true; // 172.16.0.0/12
  if ((n & 0xffff0000) === 0xc0a80000) return true; // 192.168.0.0/16
  if ((n & 0xffff0000) === 0xa9fe0000) return true; // 169.254.0.0/16 link-local
  if (n === 0) return true;
  return false;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

function hostLooksBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".internal")) return true;
  if (isPrivateOrReservedIpv4(host)) return true;
  if (host.includes(":") && isPrivateOrReservedIpv6(host)) return true;
  return false;
}

function allowPrivateEndpoints(): boolean {
  return process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT === "1";
}

export function validateOutboundSurrealEndpoint(
  endpoint: string,
): { ok: true } | { ok: false; message: string } {
  const url = parseEndpointUrl(endpoint);
  if (!url) {
    return { ok: false, message: "Invalid Surreal endpoint URL." };
  }

  const proto = url.protocol.replace(":", "");
  const host = url.hostname;
  const prod = isProductionRuntime();

  if (prod && proto !== "https") {
    return {
      ok: false,
      message: "Production requires an HTTPS Surreal endpoint (e.g. https://….surreal.cloud).",
    };
  }

  if (!prod && proto !== "https" && proto !== "http") {
    return { ok: false, message: "Surreal endpoint must use http or https." };
  }

  const h = host.toLowerCase();
  const isLoopback = h === "localhost" || h === "127.0.0.1" || h === "::1";

  if (!prod && proto === "http") {
    if (!isLoopback) {
      return {
        ok: false,
        message: "In development, HTTP is only allowed for localhost (use HTTPS for remote hosts).",
      };
    }
    return { ok: true };
  }

  if (!prod && isLoopback) {
    return { ok: true };
  }

  if (!allowPrivateEndpoints() && hostLooksBlocked(host)) {
    return {
      ok: false,
      message:
        "This endpoint is not allowed from Restormel servers (private or metadata addresses). Use a public HTTPS Surreal URL, or set RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT=1 for local operator testing only.",
    };
  }

  return { ok: true };
}
