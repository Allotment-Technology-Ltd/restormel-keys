#!/usr/bin/env node
/**
 * Phase 2 gate: Zuplo routes.oas.json exposes Graph v1 paths with KEYS_SITE_ORIGIN.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oasPath = resolve(root, 'zuplo-gateway/config/routes.oas.json');
const oas = JSON.parse(readFileSync(oasPath, 'utf8'));

const requiredPaths = [
  ['/graph/v1/layout', 'post'],
  ['/graph/v1/snapshots/{snapshotId}', 'get'],
];

for (const [path, method] of requiredPaths) {
  if (!oas.paths?.[path]?.[method]) {
    console.error(`[validate-zuplo-graph-v1] missing ${method.toUpperCase()} ${path}`);
    process.exit(1);
  }
  const baseUrl = oas.paths[path][method]['x-zuplo-route']?.handler?.options?.baseUrl ?? '';
  if (!String(baseUrl).includes('KEYS_SITE_ORIGIN')) {
    console.error(`[validate-zuplo-graph-v1] ${path} must use KEYS_SITE_ORIGIN`);
    process.exit(1);
  }
}

console.log('[validate-zuplo-graph-v1] OK');
