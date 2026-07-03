#!/usr/bin/env node
/**
 * Phase 1 gate: Zuplo routes.oas.json exposes Keys v1 paths with KEYS_SITE_ORIGIN.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oasPath = resolve(root, 'zuplo-gateway/config/routes.oas.json');
const raw = readFileSync(oasPath, 'utf8');
let oas;
try {
  oas = JSON.parse(raw);
} catch (e) {
  console.error('[validate-zuplo-keys-v1] invalid JSON:', e instanceof Error ? e.message : e);
  process.exit(1);
}

const requiredPaths = [
  '/keys/v1/catalog',
  '/keys/v1/models',
  '/keys/v1/projects/{projectId}/resolve',
  '/keys/v1/policies/evaluate',
];

for (const path of requiredPaths) {
  if (!oas.paths?.[path]) {
    console.error(`[validate-zuplo-keys-v1] missing path: ${path}`);
    process.exit(1);
  }
  const methods = oas.paths[path];
  const methodKey = path.includes('resolve') || path.includes('evaluate') ? 'post' : 'get';
  const route = methods[methodKey]?.['x-zuplo-route'];
  const baseUrl = route?.handler?.options?.baseUrl ?? '';
  if (!String(baseUrl).includes('KEYS_SITE_ORIGIN')) {
    console.error(`[validate-zuplo-keys-v1] ${path} must forward to \${env.KEYS_SITE_ORIGIN}`);
    process.exit(1);
  }
}

console.log('[validate-zuplo-keys-v1] OK');
