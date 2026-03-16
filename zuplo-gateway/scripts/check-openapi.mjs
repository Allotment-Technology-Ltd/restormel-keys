import { readFile } from "node:fs/promises";

const ROUTES_PATH = new URL("../config/routes.oas.json", import.meta.url);

const REQUIRED_PATHS = [
  "/api/health",
  "/api/projects",
  "/api/projects/{id}",
  "/api/projects/{id}/keys",
];

const REQUIRED_SERVERS = [
  "https://restormel-keys-gateway-main-bc13eba.zuplo.app",
  "https://restormel-keys-gateway-working-co-185f3e3.zuplo.app",
];

function fail(msg) {
  console.error(`[openapi-check] ${msg}`);
  process.exitCode = 1;
}

const raw = await readFile(ROUTES_PATH, "utf8");
let doc;
try {
  doc = JSON.parse(raw);
} catch {
  fail("config/routes.oas.json is not valid JSON");
  process.exit(1);
}

if (!doc?.openapi || typeof doc.openapi !== "string") {
  fail("Missing openapi version");
}

const servers = Array.isArray(doc.servers) ? doc.servers.map((s) => s?.url).filter(Boolean) : [];
for (const url of REQUIRED_SERVERS) {
  if (!servers.includes(url)) fail(`Missing server url: ${url}`);
}

const paths = doc?.paths ?? {};
for (const p of REQUIRED_PATHS) {
  if (!paths[p]) fail(`Missing path: ${p}`);
}

// Verify Zuplo wiring exists on operations (x-zuplo-route).
for (const p of REQUIRED_PATHS) {
  const pathItem = paths[p];
  for (const method of ["get", "post", "patch", "delete"]) {
    if (!pathItem?.[method]) continue;
    const zr = pathItem[method]["x-zuplo-route"];
    if (!zr?.handler?.export || !zr?.handler?.module) fail(`Missing x-zuplo-route handler for ${method.toUpperCase()} ${p}`);
    const inbound = zr?.policies?.inbound;
    if (!Array.isArray(inbound) || inbound.length === 0) fail(`Missing inbound policies for ${method.toUpperCase()} ${p}`);
  }
}

if (process.exitCode) process.exit(1);
console.log("[openapi-check] OK");

