#!/usr/bin/env node
/**
 * Validates docs/api/openapi-suite-v1-draft.yaml for suite migration gates.
 * Phase 0: planned namespaces. Phase 1+: Keys v1 marked implemented.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const draftPath = resolve(root, 'docs/api/openapi-suite-v1-draft.yaml');
const raw = readFileSync(draftPath, 'utf8');

const requiredFragments = [
  '/keys/v1/',
  '/graph/v1/',
  '/connect/v1/',
  'KnowledgeVerifyRequest',
  'KnowledgeRetrieveRequest',
  'ConnectIngestJobCreateRequest',
];

for (const fragment of requiredFragments) {
  if (!raw.includes(fragment)) {
    console.error(`[validate-openapi-suite-draft] missing: ${fragment}`);
    process.exit(1);
  }
}

const keysV1Paths = [
  '/keys/v1/projects/{projectId}/resolve',
  '/keys/v1/catalog',
  '/keys/v1/models',
  '/keys/v1/policies/evaluate',
];

for (const path of keysV1Paths) {
  if (!raw.includes(path)) {
    console.error(`[validate-openapi-suite-draft] missing Keys v1 path: ${path}`);
    process.exit(1);
  }
}

const implementedCount = (raw.match(/x-restormel-implementation-status: implemented/g) ?? []).length;
// Phase 6+: 4 Keys + 2 Graph + 5 Knowledge operations (verify, retrieve, ingest create/list/status)
const minImplemented = 10;
if (implementedCount < minImplemented) {
  console.error(
    `[validate-openapi-suite-draft] expected >= ${minImplemented} implemented suite v1 operations, found ${implementedCount}`
  );
  process.exit(1);
}

console.log('[validate-openapi-suite-draft] OK');
