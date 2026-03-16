/**
 * Canonical domain models for Restormel Keys.
 * Aligned to the control-plane data model (docs/reference/restormel-dashboard-docs-data-onboarding.md).
 * Use these types across backend, API, and frontend for consistent naming and shape.
 *
 * Persistence: Only Project and GatewayKey are currently stored (dashboard: projects + api_keys).
 * Other entities are placeholders until wired to behaviour; no migrations added here.
 *
 * Mapping from current dashboard:
 * - neon.Project → domain.Project subset (current schema has user_id, not workspace_id; to be migrated).
 * - neon.ApiKeyRecord → domain.GatewayKey subset (id, prefix→prefix, keyHash→hashedSecret, createdAt; project_id only, no workspace/environment scope yet).
 */

// ---------------------------------------------------------------------------
// Workspace & hierarchy
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  billingModeDefaults?: Record<string, unknown>;
  createdAt: number;
  ownerUserId: string;
  settings?: Record<string, unknown>;
  status?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug?: string;
  description?: string;
  defaultBillingMode?: string;
  ownerTeamId?: string;
  status?: string;
  createdAt: number;
}

/** Deployment or operational separation (e.g. dev, staging, prod). */
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  type: string;
  status?: string;
  settings?: Record<string, unknown>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Keys (Restormel auth vs management)
// ---------------------------------------------------------------------------

/** Credential used to authenticate requests into Restormel. Stored as prefix + hash. */
export interface GatewayKey {
  id: string;
  workspaceId: string;
  projectId: string | null;
  environmentId: string | null;
  name?: string;
  /** Never store or log raw secret. */
  hashedSecret: string;
  prefix: string;
  scope?: string;
  status?: string;
  createdBy?: string;
  createdAt: number;
  lastUsedAt?: number | null;
  expiresAt?: number | null;
  rotationVersion?: number;
}

/** Credential for management API or automation (PAT). */
export interface ManagementKey {
  id: string;
  workspaceId: string;
  name?: string;
  hashedSecret: string;
  prefix: string;
  role?: string;
  scopes?: string[];
  status?: string;
  createdBy?: string;
  createdAt: number;
  lastUsedAt?: number | null;
  expiresAt?: number | null;
}

// ---------------------------------------------------------------------------
// Provider integrations
// ---------------------------------------------------------------------------

export interface ProviderIntegration {
  id: string;
  workspaceId: string;
  providerType: string;
  displayName?: string;
  status?: string;
  verificationStatus?: string;
  /** Reference to stored credential (no raw value in type). */
  credentialRef?: string;
  createdBy?: string;
  createdAt: number;
  lastVerifiedAt?: number | null;
  metadata?: Record<string, unknown>;
  region?: string | null;
}

/** Controls where a provider integration may be used (project/environment binding). */
export interface ProviderBinding {
  id: string;
  providerIntegrationId: string;
  projectId: string;
  environmentId: string | null;
  status?: string;
  usageMode?: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

export type LifecycleState = "active" | "legacy" | "deprecated" | "retired";

export interface Model {
  id: string;
  canonicalName: string;
  family?: string;
  lifecycleState?: LifecycleState;
  description?: string;
  modalities?: string[];
  capabilities?: string[];
  contextWindow?: number;
  maxOutputTokens?: number | null;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  supportsMcp?: boolean;
  editorialSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendedFor?: string[];
  avoidFor?: string[];
  deprecationDate?: number | null;
  retirementDate?: number | null;
  replacementModelId?: string | null;
  sourceLastVerifiedAt?: number | null;
}

/** Provider-specific view of a model (same logical model may differ per provider). */
export interface ProviderModelVariant {
  id: string;
  modelId: string;
  providerIntegrationType: string;
  providerModelId: string;
  availabilityStatus?: string;
  pricingRef?: string;
  rateLimitRef?: string;
  metadata?: Record<string, unknown>;
  sourceLastVerifiedAt?: number | null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface Route {
  id: string;
  projectId: string;
  environmentId: string;
  name: string;
  description?: string;
  defaultModelId?: string | null;
  billingMode?: string;
  routeMode?: string;
  status?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RouteStep {
  id: string;
  routeId: string;
  orderIndex: number;
  providerPreference?: string | null;
  modelId?: string | null;
  conditionBlock?: Record<string, unknown>;
  fallbackOn?: string;
  timeoutMs?: number | null;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type PolicyType =
  | "model_allowlist"
  | "model_denylist"
  | "provider_allowlist"
  | "provider_denylist"
  | "budget_cap"
  | "token_cap"
  | "environment_restriction"
  | "deprecated_model_block"
  | "privacy_constraint"
  | "downstream_exposure";

export interface Policy {
  id: string;
  workspaceId: string;
  name: string;
  type: PolicyType;
  status?: string;
  ruleDefinition?: Record<string, unknown>;
  createdBy?: string;
  createdAt: number;
}

export type PolicyTargetType = "workspace" | "project" | "environment" | "route" | "customer_tenant";

export interface PolicyBinding {
  id: string;
  policyId: string;
  targetType: PolicyTargetType;
  targetId: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Logs, usage, audit
// ---------------------------------------------------------------------------

export interface RequestLog {
  id: string;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  routeId: string | null;
  gatewayKeyId: string | null;
  customerTenantId: string | null;
  providerType: string;
  providerModelVariantId?: string | null;
  finalModelId?: string | null;
  requestStatus: string;
  latencyMs: number;
  ttftMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  estimatedCost?: number | null;
  fallbackCount?: number;
  errorCode?: string | null;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface UsageAggregate {
  id: string;
  granularity: string;
  periodStart: number;
  periodEnd: number;
  workspaceId: string | null;
  projectId: string | null;
  environmentId: string | null;
  routeId: string | null;
  gatewayKeyId: string | null;
  customerTenantId: string | null;
  providerType: string | null;
  modelId: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  estimatedCost?: number;
  avgLatencyMs?: number;
  errorRate?: number;
  fallbackRate?: number;
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorId: string;
  actorType: string;
  eventType: string;
  targetType: string;
  targetId: string;
  summary?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Downstream / tenants (optional)
// ---------------------------------------------------------------------------

export interface CustomerTenant {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  slug: string;
  status?: string;
  billingReference?: string | null;
  createdAt: number;
}

export interface ExposureRule {
  id: string;
  targetTenantId: string;
  routeId: string | null;
  modelId: string | null;
  providerType: string | null;
  status?: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Supporting entities (catalog / pricing)
// ---------------------------------------------------------------------------

export interface PricingRecord {
  id: string;
  providerModelVariantId: string;
  currency: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number | null;
  imagePricing?: Record<string, unknown> | null;
  toolPricing?: Record<string, unknown> | null;
  effectiveFrom: number;
  sourceUrl?: string;
  sourceLastVerifiedAt?: number | null;
}

export interface RateLimitRecord {
  id: string;
  providerModelVariantId: string;
  limitType: string;
  value: number;
  unit?: string;
  notes?: string;
  sourceUrl?: string;
  sourceLastVerifiedAt?: number | null;
}

export type LifecycleEventType =
  | "active"
  | "legacy"
  | "deprecated"
  | "retired"
  | "migration_notice";

export interface LifecycleEvent {
  id: string;
  modelId: string;
  eventType: LifecycleEventType;
  effectiveDate: number;
  sourceUrl?: string;
  summary?: string;
  replacementModelId?: string | null;
  createdAt: number;
}
