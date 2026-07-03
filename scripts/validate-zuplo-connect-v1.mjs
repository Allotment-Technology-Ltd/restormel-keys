#!/usr/bin/env node
/**
 * Phase 6 gate: Zuplo routes.oas.json exposes Connect v1 paths with KEYS_SITE_ORIGIN.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oasPath = resolve(root, 'zuplo-gateway/config/routes.oas.json');
const oas = JSON.parse(readFileSync(oasPath, 'utf8'));

const requiredPaths = [
  ['/connect/v1/verify', 'post'],
  ['/connect/v1/retrieve', 'post'],
  ['/connect/v1/ingest/jobs', 'post'],
  ['/connect/v1/ingest/jobs', 'get'],
  ['/connect/v1/ingest/jobs/{jobId}', 'get'],
];

for (const [path, method] of requiredPaths) {
  if (!oas.paths?.[path]?.[method]) {
    console.error(`[validate-zuplo-connect-v1] missing ${method.toUpperCase()} ${path}`);
    process.exit(1);
  }
  const baseUrl = oas.paths[path][method]['x-zuplo-route']?.handler?.options?.baseUrl ?? '';
  if (!String(baseUrl).includes('KEYS_SITE_ORIGIN')) {
    console.error(`[validate-zuplo-connect-v1] ${path} must use KEYS_SITE_ORIGIN`);
    process.exit(1);
  }
}

console.log('[validate-zuplo-connect-v1] OK');
